// Two-stage chained research pipeline:
//   Stage 1 — Perplexity sonar-pro gathers raw web research about the hotel
//             and returns a dossier that matches HOTEL_RESEARCH_SCHEMA.
//   Stage 2 — Claude (Haiku 4.5) reads the dossier and rewrites the
//             analytical sections — key_challenges, mews_qualification,
//             mews_positioning — into a sales-ready form. Factual sections
//             (hotel, property_profile, services, reputation, contacts,
//             tech_stack_signals, sources) are preserved verbatim from
//             Stage 1.
//
// Both stages stream their own log events through a single SSE channel, so
// the existing frontend (app/page.tsx) can render them without changes other
// than pointing to this route.
//
// If Stage 2 fails we still return the Stage-1 dossier — the user sees the
// raw Perplexity result and a warning log instead of a hard error.

import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
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
  const { hotelName, city, country } = await req.json();

  if (!hotelName || !city || !country) {
    return new Response(
      JSON.stringify({ error: "hotelName, city and country are required" }),
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
  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response(
      JSON.stringify({
        error: "ANTHROPIC_API_KEY is not configured on the server",
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

      // Proxy-defeating padding + heartbeat, same pattern as the other routes.
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

      // Aggregate token usage across both stages so the UI can show it.
      let totalInputTokens = 0;
      let totalOutputTokens = 0;
      let totalCachedTokens = 0;

      try {
        // ─── STAGE 1 — Perplexity research ──────────────────────────────
        send({
          type: "log",
          level: "start",
          message: `Stage 1/2 — Perplexity gathering research on "${hotelName}" (${city}, ${country})`,
          t: elapsed(),
        });

        const userPrompt = `Research this hotel and return the full dossier as a single JSON object.

Hotel: ${hotelName}
City: ${city}
Country: ${country}

Cover everything the schema asks for: website, property profile, services (F&B, spa, events/MICE), reputation (review ratings + recurring themes filled to their caps where evidence supports it), key challenges tied to review evidence, tech-stack signals, and a tailored Mews positioning. Ground \`mews_qualification\` and \`mews_positioning\` in the Mews playbook primer from the system prompt — quote segment fit-signals and red-flags verbatim from the cheat-sheet. Include source URLs (aim for 10+).

CONTACTS ARE MANDATORY: the \`contacts\` array must never be empty. Find the General Manager's name at minimum (LinkedIn, hotel "Team"/"About" page, press releases). If you truly cannot find a named person, emit a fallback contact with the hotel's \`reservations@\` / \`sales@\` / \`info@\` email + reception phone and \`role: "Reservations Team"\` — scraped from the hotel's own contact page.

KEY CHALLENGES ARE A PREMIUM DELIVERABLE: aim for 4-6 \`key_challenges\` per hotel, mixing \`guest_reviews\` (≥2 quotes each) with \`segment_profile\` / \`tech_stack\` / \`services_gap\` / \`press_or_ownership\` (each with an \`evidence_basis\`). Every hotel has structural challenges tied to its segment and tech — don't limit yourself to what guests have publicly complained about. Every challenge needs a specific \`mews_angle\` naming a Mews product, and \`payment_related: true\` whenever money movement is implicated.

Spend your full 8-search budget. Run the mandatory depth & completeness self-review checklist before returning.

Return only the JSON object, no prose, no code fences.`;

        const perplexityRes = await fetch(
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

        if (!perplexityRes.ok) {
          const errText = await perplexityRes.text();
          let errMsg = `Perplexity API error ${perplexityRes.status}`;
          try {
            const parsed = JSON.parse(errText);
            if (parsed?.error?.message) errMsg = parsed.error.message;
          } catch {
            // use status message
          }
          if (perplexityRes.status === 401) {
            errMsg =
              "Invalid Perplexity API key — please check PERPLEXITY_API_KEY in your Vercel environment variables.";
          } else if (perplexityRes.status === 429) {
            errMsg =
              "Perplexity rate limit reached — please try again in a few minutes.";
          } else if (perplexityRes.status === 402) {
            errMsg =
              "Perplexity account is out of credits — please top up at perplexity.ai.";
          }
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

        const pplxData = (await perplexityRes.json()) as {
          choices?: {
            message?: { content?: string };
            finish_reason?: string;
          }[];
          usage?: {
            prompt_tokens?: number;
            completion_tokens?: number;
            prompt_tokens_cached?: number;
            cached_tokens?: number;
          };
        };

        const fullContent = pplxData.choices?.[0]?.message?.content ?? "";
        const pplxIn = pplxData.usage?.prompt_tokens ?? 0;
        const pplxOut = pplxData.usage?.completion_tokens ?? 0;
        const pplxCached =
          pplxData.usage?.prompt_tokens_cached ??
          pplxData.usage?.cached_tokens ??
          0;
        totalInputTokens += pplxIn;
        totalOutputTokens += pplxOut;
        totalCachedTokens += pplxCached;

        send({
          type: "log",
          level: "done",
          message: `Perplexity finished — parsing JSON… (in=${pplxIn}, cached=${pplxCached}, out=${pplxOut})`,
          t: elapsed(),
        });

        if (!fullContent) {
          send({ type: "error", error: "Perplexity returned no content" });
          finish();
          return;
        }

        let rawDossier: unknown;
        try {
          rawDossier = extractJson(fullContent);
        } catch {
          send({
            type: "error",
            error: "Failed to parse JSON from Perplexity response",
            raw: fullContent,
          });
          finish();
          return;
        }

        // Enrich with hero image from the hotel's own site. We do this after
        // Stage 1 so Stage 2 sees the image URL too (in case Claude wants to
        // reference it in the positioning — though currently it doesn't).
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

        // ─── STAGE 2 — Claude analysis ──────────────────────────────────
        send({
          type: "log",
          level: "start",
          message: "Stage 2/2 — Claude analyzing the dossier for solution fit…",
          t: elapsed(),
        });

        const client = new Anthropic();

        const analysisUserPrompt = `Here is the raw research dossier for ${hotelName} in ${city}, ${country}, gathered by Perplexity with live web search. Read it end-to-end and return the refined dossier per your system instructions.

Preserve \`hotel\`, \`property_profile\`, \`services\`, \`reputation\`, \`contacts\`, \`tech_stack_signals\`, and \`sources\` verbatim. Rewrite \`key_challenges\`, \`mews_qualification\`, and \`mews_positioning\` with your analyst's judgment.

Raw dossier JSON follows:

${JSON.stringify(rawDossier, null, 2)}

Return ONLY the refined dossier JSON object. No prose, no code fences.`;

        let analyzedDossier: unknown = null;
        try {
          const analysisRes = await client.messages.create({
            // Haiku 4.5 is fast and cheap; it handles this read-and-refine
            // task comfortably. Bump to Sonnet 4.6 here if analysis quality
            // is ever the bottleneck — same SDK, one-line change.
            model: "claude-haiku-4-5",
            max_tokens: 8000,
            system: [
              {
                type: "text",
                text: ANALYSIS_SYSTEM_PROMPT,
                cache_control: { type: "ephemeral" },
              },
            ],
            messages: [{ role: "user", content: analysisUserPrompt }],
          });

          const claudeIn = analysisRes.usage?.input_tokens ?? 0;
          const claudeOut = analysisRes.usage?.output_tokens ?? 0;
          const claudeCached =
            analysisRes.usage?.cache_read_input_tokens ?? 0;
          totalInputTokens += claudeIn;
          totalOutputTokens += claudeOut;
          totalCachedTokens += claudeCached;

          const textBlock = analysisRes.content.find(
            (b): b is Anthropic.Messages.TextBlock => b.type === "text",
          );
          const analysisText = textBlock?.text ?? "";

          send({
            type: "log",
            level: "done",
            message: `Claude analysis done — parsing JSON… (in=${claudeIn}, cached=${claudeCached}, out=${claudeOut})`,
            t: elapsed(),
          });

          if (!analysisText) {
            throw new Error("Claude returned no text content");
          }
          analyzedDossier = extractJson(analysisText);
        } catch (err) {
          // If the analysis step fails for any reason, we still want the
          // user to get the Perplexity dossier back — better a raw result
          // than nothing. Log a warning so they can see what went wrong.
          const msg = err instanceof Error ? err.message : String(err);
          send({
            type: "log",
            level: "warn",
            message: `Claude analysis failed (${msg}) — returning raw Perplexity dossier.`,
            t: elapsed(),
          });
          analyzedDossier = rawDossier;
        }

        // Safety net: if Claude's refined dossier is missing hero_image_url
        // (likely — our analysis prompt tells Claude to preserve \`hotel\`
        // verbatim, but models sometimes drop fields they don't understand),
        // patch it back in from the Perplexity dossier.
        const analyzed = analyzedDossier as {
          hotel?: { hero_image_url?: string };
        } | null;
        const rawHotel = (rawDossier as { hotel?: { hero_image_url?: string } } | null)
          ?.hotel;
        if (
          analyzed?.hotel &&
          !analyzed.hotel.hero_image_url &&
          rawHotel?.hero_image_url
        ) {
          analyzed.hotel.hero_image_url = rawHotel.hero_image_url;
        }

        send({
          type: "dossier",
          dossier: analyzedDossier,
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
        finish();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        send({ type: "error", error: msg });
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
