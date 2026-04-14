import { NextRequest } from "next/server";
import { SYSTEM_PROMPT } from "@/lib/researchPrompt";
import { HOTEL_RESEARCH_SCHEMA } from "@/lib/schema";

// Deep research runs can take a while — allow up to 5 minutes on Vercel.
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

      // Proxy-defeating padding
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

      try {
        send({
          type: "log",
          level: "start",
          message: `Starting deep research on "${hotelName}" (${city}, ${country}) via Perplexity`,
          t: elapsed(),
        });

        const userPrompt = `Research this hotel and return the full dossier as a single JSON object.

Hotel: ${hotelName}
City: ${city}
Country: ${country}

Cover everything the schema asks for: website, property profile, services (F&B, spa, events/MICE), reputation (review ratings + recurring themes filled to their caps where evidence supports it), key challenges tied to review evidence, named contacts for outreach, tech-stack signals, and a tailored Mews positioning. Ground \`mews_qualification\` and \`mews_positioning\` in the Mews playbook primer from the system prompt — quote segment fit-signals and red-flags verbatim from the cheat-sheet. Include source URLs (aim for 10+).

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
              // Enforce the dossier shape server-side so we no longer need
              // to stringify the schema into the prompt (saves ~4-5k input
              // tokens per call) and reduces JSON-parse failures.
              response_format: {
                type: "json_schema",
                json_schema: { schema: HOTEL_RESEARCH_SCHEMA },
              },
              // Keep "high" search context — this dossier relies on deep web
              // evidence (recent reviews, named contacts, tech-stack hints).
              // "medium" made outputs visibly lighter in testing.
              web_search_options: { search_context_size: "high" },
              // Give the model enough room for a full rich JSON dossier.
              // Under structured output, Perplexity's implicit cap can
              // quietly truncate — an explicit ceiling prevents that.
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

        // Use non-streaming so we get a single, reliable JSON response.
        // The heartbeat above keeps the SSE connection alive and shows
        // "Still working…" while we wait.
        const data = (await perplexityRes.json()) as {
          choices?: { message?: { content?: string }; finish_reason?: string }[];
          usage?: {
            prompt_tokens?: number;
            completion_tokens?: number;
            // Perplexity returns cached prefix tokens when auto-caching
            // hits. Naming varies across provider versions — accept both.
            prompt_tokens_cached?: number;
            cached_tokens?: number;
          };
        };

        const fullContent = data.choices?.[0]?.message?.content ?? "";
        const inputTokens = data.usage?.prompt_tokens ?? 0;
        const outputTokens = data.usage?.completion_tokens ?? 0;
        const cachedTokens =
          data.usage?.prompt_tokens_cached ?? data.usage?.cached_tokens ?? 0;

        send({
          type: "log",
          level: "done",
          message: `Perplexity finished — parsing JSON… (in=${inputTokens}, cached=${cachedTokens}, out=${outputTokens})`,
          t: elapsed(),
        });

        if (!fullContent) {
          send({ type: "error", error: "Perplexity returned no content" });
          finish();
          return;
        }

        let dossier: unknown;
        try {
          dossier = extractJson(fullContent);
        } catch {
          send({
            type: "error",
            error: "Failed to parse JSON from Perplexity response",
            raw: fullContent,
          });
          finish();
          return;
        }

        // Enrich with hero image from the hotel's own site
        const d = dossier as {
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

        send({
          type: "dossier",
          dossier,
          usage:
            inputTokens || outputTokens
              ? {
                  input_tokens: inputTokens,
                  output_tokens: outputTokens,
                  cached_tokens: cachedTokens,
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
