// Two-stage Perplexity-only research pipeline:
//
//   Stage 1 — sonar-pro  : autonomous deep web search on the hotel,
//             returns a raw dossier matching HOTEL_RESEARCH_SCHEMA.
//
//   Stage 2 — r1-1776    : offline DeepSeek-R1 reasoning model reads the
//             Stage-1 dossier and rewrites the analytical sections —
//             key_challenges, mews_qualification, mews_positioning — into
//             sales-ready form using the full Mews playbook.
//             Factual sections (hotel, property_profile, services,
//             reputation, contacts, tech_stack_signals, sources) are
//             preserved verbatim from Stage 1 — r1-1776 adds no web searches
//             and cannot invent facts.
//
// Both stages surface their own log events through a single SSE channel, so
// the frontend renders real-time progress for both steps.
//
// If Stage 2 fails for any reason the raw Stage-1 dossier is returned with a
// WARN log — the user always gets a result.

import { NextRequest } from "next/server";
import { SYSTEM_PROMPT } from "@/lib/researchPrompt";
import { ANALYSIS_SYSTEM_PROMPT } from "@/lib/analysisPrompt";
import { HOTEL_RESEARCH_SCHEMA } from "@/lib/schema";

export const maxDuration = 300;
export const runtime = "nodejs";

function stripCitationTags(text: string): string {
  return text
    .replace(/<\/?cite\b[^>]*>/gi, "")
    .replace(/<\/?antml:cite\b[^>]*>/gi, "");
}

/** Minimum viability check for a dossier before sending it to the caller.
 *  A truncated or hallucinated response can parse as valid JSON but still
 *  be missing the fields the UI requires — catch that here rather than
 *  silently serving garbage to the sales rep. */
function isDossierUsable(dossier: unknown): boolean {
  if (!dossier || typeof dossier !== "object") return false;
  const d = dossier as Record<string, unknown>;
  const hotel = d.hotel as Record<string, unknown> | undefined;
  if (!hotel?.name || typeof hotel.name !== "string" || !hotel.name.trim())
    return false;
  if (!Array.isArray(d.contacts)) return false;
  return true;
}

function extractJson(text: string): unknown {
  const cleaned = stripCitationTags(text);
  try {
    return JSON.parse(cleaned);
  } catch {
    // continue
  }
  const fenced = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) {
    try {
      return JSON.parse(fenced[1]);
    } catch {
      // continue
    }
  }
  const first = cleaned.indexOf("{");
  const last = cleaned.lastIndexOf("}");
  if (first !== -1 && last > first) {
    try {
      return JSON.parse(cleaned.slice(first, last + 1));
    } catch {
      // continue
    }
  }
  throw new Error("Could not extract JSON from model response");
}

async function fetchOgImage(pageUrl: string): Promise<string | null> {
  try {
    const res = await fetch(pageUrl, {
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; MewsHotelIntelligence/1.0; +https://mews.com)",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const html = (await res.text()).slice(0, 200_000);
    const patterns = [
      /<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]*content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::secure_url)?["']/i,
      /<meta[^>]+name=["']twitter:image(?::src)?["'][^>]*content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image(?::src)?["']/i,
    ];
    for (const re of patterns) {
      const m = html.match(re);
      if (m?.[1]) {
        let img = m[1].trim();
        if (img.startsWith("//")) img = "https:" + img;
        else if (img.startsWith("/")) {
          const origin = new URL(pageUrl).origin;
          img = origin + img;
        }
        return img;
      }
    }
    return null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Sanitize inputs to prevent prompt injection: enforce string type,
  // strip newlines / control characters, and cap length.
  const sanitize = (val: unknown): string | null => {
    if (typeof val !== "string") return null;
    const s = val.trim().replace(/[\r\n\t\x00-\x1f\x7f]+/g, " ").trim();
    return s.length > 0 && s.length <= 200 ? s : null;
  };

  const hotelName = sanitize(body.hotelName);
  const city = sanitize(body.city);
  const country = sanitize(body.country);

  if (!hotelName || !city || !country) {
    return new Response(
      JSON.stringify({ error: "hotelName, city and country are required (strings, max 200 chars each)" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  if (!process.env.PERPLEXITY_API_KEY) {
    return new Response(
      JSON.stringify({
        error: "PERPLEXITY_API_KEY is not configured on the server",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  const encoder = new TextEncoder();
  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const safeEnqueue = (bytes: Uint8Array) => {
        if (closed) return;
        try {
          controller.enqueue(bytes);
        } catch {
          closed = true;
        }
      };
      const send = (obj: unknown) => {
        safeEnqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
        lastEventAt = Date.now();
      };
      const sendComment = (text: string) => {
        safeEnqueue(encoder.encode(`: ${text}\n\n`));
      };

      const startedAt = Date.now();
      let lastEventAt = startedAt;
      const elapsed = () => ((Date.now() - startedAt) / 1000).toFixed(1) + "s";

      // Proxy-defeating padding + heartbeat.
      safeEnqueue(encoder.encode(`: ${" ".repeat(2048)}\n\n`));
      const heartbeat = setInterval(() => {
        if (closed) return;
        sendComment("ping");
        const silence = Date.now() - lastEventAt;
        if (silence > 5000) {
          send({
            type: "log",
            level: "think",
            message: `Still working… (${Math.round(silence / 1000)}s since last event)`,
            t: elapsed(),
          });
        }
      }, 2000);

      const finish = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        try {
          controller.close();
        } catch {
          // already closed
        }
      };

      // Aggregate token usage across both stages for the UI.
      let totalInputTokens = 0;
      let totalOutputTokens = 0;
      let totalCachedTokens = 0;

      try {
        // ── STAGE 1 — Perplexity sonar-pro web search ────────────────────
        send({
          type: "log",
          level: "start",
          message: `Stage 1/2 — Perplexity searching the web for "${hotelName}" (${city}, ${country})`,
          t: elapsed(),
        });

        const userPrompt = `Research this hotel thoroughly and return the complete dossier as a single JSON object.

Hotel: ${hotelName}
City: ${city}
Country: ${country}

Work through every coverage area in the system prompt's "How to work" checklist before returning. Here is what to prioritise:

**Contacts (MANDATORY — contacts array must never be empty):**
Find at least two named individuals. Start with the General Manager: check LinkedIn ("General Manager" "${hotelName}"), the hotel's own "Team"/"About"/"Leadership" page, and press releases on PR Newswire / Hospitality Net / Hotel Management. Then find one commercial role: DOSM, Director of Sales, Revenue Manager, F&B Director, Events Manager, Owner, or Asset Manager — same sources. For each person, capture their name, title, LinkedIn URL (only if found on a public page), and email (only if printed on a public page — never guess). If you genuinely cannot find any named individual after checking all those sources, fall back to the hotel's shared inbox (reservations@ / sales@ / info@) and reception phone from the contact page, emitting them as role: "Reservations Team". That fallback row counts — but always attempt Tier 1 first.

**Key challenges (PREMIUM DELIVERABLE — target 4–6, mix evidence types):**
Every hotel has challenges beyond what guests publicly complain about. You need a healthy mix:
- At least 1–2 guest_reviews challenges: pull ≥2 recent verbatim quotes per challenge (last 12 months). Look hard for payment / billing / check-in / check-out friction in the reviews — these unlock payment_related: true challenges.
- At least 2 profile-driven challenges using segment_profile, tech_stack, services_gap, or press_or_ownership. Think structurally: what does a hotel of this size, segment, and tech posture inherently struggle with? Scan the Payments-pillar radar (OTA VCC reconciliation, no-show recovery, corporate bank-transfer friction, split folios, manual invoicing, chargebacks, tipping, currency surprises) — flag every match with payment_related: true.
Every challenge must name a specific Mews product in mews_angle — not "Mews can help", but the exact module and what it solves for this hotel.

**Everything else:** Fill all schema fields for which evidence exists. Aim for 10+ source URLs. Run the mandatory depth & completeness self-review checklist before returning. Ground mews_qualification and mews_positioning in the playbook primer — quote segment fit-signals and red-flags verbatim from the cheat-sheet.

Return only the JSON object, no prose, no code fences.`;

        const stage1Res = await fetch(
          "https://api.perplexity.ai/chat/completions",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${process.env.PERPLEXITY_API_KEY}`,
            },
            body: JSON.stringify({
              model: "sonar-pro",
              messages: [
                { role: "system", content: SYSTEM_PROMPT },
                { role: "user", content: userPrompt },
              ],
              response_format: {
                type: "json_schema",
                json_schema: { schema: HOTEL_RESEARCH_SCHEMA },
              },
              web_search_options: { search_context_size: "high" },
              max_tokens: 8000,
            }),
          },
        );

        if (!stage1Res.ok) {
          const errText = await stage1Res.text();
          let errMsg = `Perplexity API error ${stage1Res.status}`;
          try {
            const parsed = JSON.parse(errText);
            if (parsed?.error?.message) errMsg = parsed.error.message;
          } catch {
            // use status message
          }
          if (stage1Res.status === 401)
            errMsg =
              "Invalid Perplexity API key — please check PERPLEXITY_API_KEY in your Vercel environment variables.";
          else if (stage1Res.status === 429)
            errMsg =
              "Perplexity rate limit reached — please try again in a few minutes.";
          else if (stage1Res.status === 402)
            errMsg =
              "Perplexity account is out of credits — please top up at perplexity.ai.";
          send({ type: "error", error: errMsg });
          finish();
          return;
        }

        send({
          type: "log",
          level: "search",
          message: "Perplexity is searching the web…",
          t: elapsed(),
        });

        const stage1Data = (await stage1Res.json()) as {
          choices?: { message?: { content?: string } }[];
          usage?: {
            prompt_tokens?: number;
            completion_tokens?: number;
            prompt_tokens_cached?: number;
            cached_tokens?: number;
          };
        };

        const stage1Content = stage1Data.choices?.[0]?.message?.content ?? "";
        const s1In = stage1Data.usage?.prompt_tokens ?? 0;
        const s1Out = stage1Data.usage?.completion_tokens ?? 0;
        const s1Cached =
          stage1Data.usage?.prompt_tokens_cached ??
          stage1Data.usage?.cached_tokens ??
          0;
        totalInputTokens += s1In;
        totalOutputTokens += s1Out;
        totalCachedTokens += s1Cached;

        send({
          type: "log",
          level: "done",
          message: `Stage 1 done — parsing JSON… (in=${s1In}, cached=${s1Cached}, out=${s1Out})`,
          t: elapsed(),
        });

        if (!stage1Content) {
          send({ type: "error", error: "Perplexity returned no content" });
          finish();
          return;
        }

        let rawDossier: unknown;
        try {
          rawDossier = extractJson(stage1Content);
        } catch {
          send({
            type: "error",
            error: "Failed to parse JSON from Perplexity response",
            raw: stage1Content,
          });
          finish();
          return;
        }

        if (!isDossierUsable(rawDossier)) {
          send({
            type: "error",
            error:
              "Stage 1 returned an incomplete dossier (missing hotel name or contacts) — the response may have been truncated. Please try again.",
          });
          finish();
          return;
        }

        // Enrich with hero image from the hotel's own site before Stage 2
        // so the analysis dossier already has the image URL.
        const d = rawDossier as {
          hotel?: { website?: string; hero_image_url?: string };
        } | null;
        const website = d?.hotel?.website;
        if (website) {
          send({
            type: "log",
            level: "result",
            message: "Fetching hero image from hotel site…",
            t: elapsed(),
          });
          const ogImage = await fetchOgImage(website);
          if (ogImage && d?.hotel) {
            d.hotel.hero_image_url = ogImage;
            send({
              type: "log",
              level: "result",
              message: `Hero image: ${ogImage.slice(0, 80)}${ogImage.length > 80 ? "…" : ""}`,
              t: elapsed(),
            });
          } else {
            send({
              type: "log",
              level: "warn",
              message: "No og:image found on hotel site — using fallback",
              t: elapsed(),
            });
          }
        }

        // ── STAGE 2 — r1-1776 reasoning analysis ─────────────────────────
        send({
          type: "log",
          level: "start",
          message:
            "Stage 2/2 — r1-1776 analyzing the dossier against the Mews playbook…",
          t: elapsed(),
        });

        const analysisUserPrompt = `Here is the raw research dossier for ${hotelName} in ${city}, ${country}, gathered by Perplexity sonar-pro with live web search. Read it end-to-end, reason carefully, then return the refined dossier per your system instructions.

Preserve \`hotel\`, \`property_profile\`, \`services\`, \`reputation\`, \`contacts\`, \`tech_stack_signals\`, and \`sources\` verbatim. Rewrite \`key_challenges\`, \`mews_qualification\`, and \`mews_positioning\` with your analyst's judgment.

Raw dossier JSON:

${JSON.stringify(rawDossier, null, 2)}

Return ONLY the refined dossier JSON object. No prose, no code fences.`;

        let finalDossier: unknown = null;

        try {
          const stage2Res = await fetch(
            "https://api.perplexity.ai/chat/completions",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${process.env.PERPLEXITY_API_KEY}`,
              },
              body: JSON.stringify({
                // sonar-reasoning-pro is Perplexity's most capable reasoning
                // model — extended chain-of-thought, ideal for applying the
                // Mews playbook to the Stage-1 dossier.
                model: "sonar-reasoning-pro",
                messages: [
                  { role: "system", content: ANALYSIS_SYSTEM_PROMPT },
                  { role: "user", content: analysisUserPrompt },
                ],
                // r1-1776 supports json_schema (not json_object) — use the
                // same schema enforcement as Stage 1 so the output shape is
                // guaranteed to match HOTEL_RESEARCH_SCHEMA.
                response_format: {
                  type: "json_schema",
                  json_schema: { schema: HOTEL_RESEARCH_SCHEMA },
                },
                max_tokens: 8000,
              }),
            },
          );

          if (!stage2Res.ok) {
            const errText = await stage2Res.text();
            let errMsg = `r1-1776 API error ${stage2Res.status}: ${errText.slice(0, 200)}`;
            try {
              const parsed = JSON.parse(errText);
              if (parsed?.error?.message) errMsg = parsed.error.message;
            } catch {
              // use status message
            }
            throw new Error(errMsg);
          }

          const stage2Data = (await stage2Res.json()) as {
            choices?: { message?: { content?: string } }[];
            usage?: {
              prompt_tokens?: number;
              completion_tokens?: number;
              prompt_tokens_cached?: number;
              cached_tokens?: number;
            };
          };

          const stage2Content =
            stage2Data.choices?.[0]?.message?.content ?? "";
          const s2In = stage2Data.usage?.prompt_tokens ?? 0;
          const s2Out = stage2Data.usage?.completion_tokens ?? 0;
          const s2Cached =
            stage2Data.usage?.prompt_tokens_cached ??
            stage2Data.usage?.cached_tokens ??
            0;
          totalInputTokens += s2In;
          totalOutputTokens += s2Out;
          totalCachedTokens += s2Cached;

          send({
            type: "log",
            level: "done",
            message: `Stage 2 done — parsing JSON… (in=${s2In}, cached=${s2Cached}, out=${s2Out})`,
            t: elapsed(),
          });

          if (!stage2Content) {
            throw new Error("r1-1776 returned no content");
          }

          finalDossier = extractJson(stage2Content);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          // Stage 2 failure is non-fatal only when Stage 1 produced a usable
          // dossier. If Stage 1 is also incomplete, fail hard rather than
          // silently serving a broken result to the sales rep.
          if (!isDossierUsable(rawDossier)) {
            send({
              type: "error",
              error: `Stage 2 failed and Stage 1 dossier is also incomplete — please try again. (${msg})`,
            });
            return; // finish() runs in the outer finally
          }
          send({
            type: "log",
            level: "warn",
            message: `Stage 2 analysis failed (${msg}) — returning Stage-1 dossier.`,
            t: elapsed(),
          });
          finalDossier = rawDossier;
        }

        // Safety net: patch hero_image_url back in if Stage 2 dropped it.
        const analyzed = finalDossier as {
          hotel?: { hero_image_url?: string };
        } | null;
        const rawHotelImg = (
          rawDossier as { hotel?: { hero_image_url?: string } } | null
        )?.hotel?.hero_image_url;
        if (analyzed?.hotel && !analyzed.hotel.hero_image_url && rawHotelImg) {
          analyzed.hotel.hero_image_url = rawHotelImg;
        }

        send({
          type: "dossier",
          dossier: finalDossier,
          usage:
            totalInputTokens || totalOutputTokens
              ? {
                  input_tokens: totalInputTokens,
                  output_tokens: totalOutputTokens,
                  cached_tokens: totalCachedTokens,
                }
              : undefined,
          elapsed: elapsed(),
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        send({ type: "error", error: msg });
      } finally {
        // Always close the stream — prevents hanging clients if an
        // unexpected exception bypasses an earlier finish() call.
        finish();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
