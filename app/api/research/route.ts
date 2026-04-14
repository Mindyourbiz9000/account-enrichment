import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { SYSTEM_PROMPT } from "@/lib/researchPrompt";

// Deep research runs can take a while — allow up to 5 minutes on Vercel.
export const maxDuration = 300;
export const runtime = "nodejs";



// Translate a raw Anthropic / transport error into something a salesperson
// can read. When the SDK gives us an APIError we can inspect the headers
// for the exact rate-limit reset time and tell the user when to come back.
const SLACK_FALLBACK =
  "If it still persists, please reach out to Thomas Barvaux on Slack.";

function formatResetIn(reset: Date): string {
  const ms = reset.getTime() - Date.now();
  if (ms <= 0) return "in a few seconds";
  const totalSec = Math.ceil(ms / 1000);
  if (totalSec < 60) return `in ${totalSec} second${totalSec === 1 ? "" : "s"}`;
  const totalMin = Math.ceil(totalSec / 60);
  if (totalMin < 60) return `in ${totalMin} minute${totalMin === 1 ? "" : "s"}`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `in ${h}h${m ? ` ${m}m` : ""}`;
}

type HeaderBag =
  | Headers
  | Record<string, string | string[] | undefined>
  | undefined
  | null;

function readHeader(headers: HeaderBag, name: string): string | null {
  if (!headers) return null;
  if (typeof (headers as Headers).get === "function") {
    return (headers as Headers).get(name);
  }
  const bag = headers as Record<string, string | string[] | undefined>;
  const val = bag[name] ?? bag[name.toLowerCase()];
  if (Array.isArray(val)) return val[0] ?? null;
  return val ?? null;
}

function soonestReset(headers: HeaderBag): Date | null {
  const candidates = [
    "anthropic-ratelimit-requests-reset",
    "anthropic-ratelimit-tokens-reset",
    "anthropic-ratelimit-input-tokens-reset",
    "anthropic-ratelimit-output-tokens-reset",
  ];
  let soonest: Date | null = null;
  for (const name of candidates) {
    const raw = readHeader(headers, name);
    if (!raw) continue;
    const t = new Date(raw);
    if (isNaN(t.getTime())) continue;
    if (!soonest || t < soonest) soonest = t;
  }
  // Fallback: retry-after header (seconds)
  if (!soonest) {
    const retryAfter = readHeader(headers, "retry-after");
    if (retryAfter) {
      const sec = parseInt(retryAfter, 10);
      if (!isNaN(sec)) soonest = new Date(Date.now() + sec * 1000);
    }
  }
  return soonest;
}

type MaybeApiError = {
  status?: number;
  headers?: HeaderBag;
  error?: { error?: { type?: string; message?: string } };
  message?: string;
};

function friendlyApiError(err: unknown): string {
  const raw =
    err instanceof Error ? err.message : typeof err === "string" ? err : "";
  const apiErr = (err ?? {}) as MaybeApiError;
  const status = apiErr.status;
  const type = apiErr.error?.error?.type ?? "";
  const apiMessage = apiErr.error?.error?.message ?? "";
  const lower = (raw + " " + type + " " + apiMessage).toLowerCase();

  // Credit balance is a hard billing issue — no reset time will save us.
  // We deliberately DON'T match on "quota" here (too broad — Anthropic uses
  // "quota" in several rate-limit contexts too). We only trigger this branch
  // when the API explicitly says credit balance / billing / insufficient funds.
  if (
    lower.includes("credit balance") ||
    lower.includes("insufficient_credit") ||
    lower.includes("insufficient funds") ||
    lower.includes("billing")
  ) {
    // Echo the raw Anthropic message so we can tell which workspace / key
    // is actually being rejected — useful when credits have been topped up
    // but the app is still using a key tied to a different workspace.
    const detail = apiMessage ? ` (API said: "${apiMessage}")` : "";
    return `Sorry — the Mews research account is out of API credits.${detail} If you just topped up, double-check that the ANTHROPIC_API_KEY on Vercel belongs to the same workspace you added credits to. Otherwise please reach out to Thomas Barvaux on Slack.`;
  }

  // Rate limit / overloaded — we can look up the reset time.
  if (
    status === 429 ||
    status === 529 ||
    lower.includes("rate_limit") ||
    lower.includes("rate limit") ||
    lower.includes("overloaded")
  ) {
    const reset = soonestReset(apiErr.headers);
    const when = reset
      ? `Please try again ${formatResetIn(reset)} (at ${reset.toLocaleTimeString(
          "en-GB",
          { hour: "2-digit", minute: "2-digit" },
        )}).`
      : "Please try again in 5 minutes.";
    return `Sorry — we've hit Anthropic's request rate limit. ${when} ${SLACK_FALLBACK}`;
  }

  // Generic capacity-ish invalid_request_error
  if (lower.includes("invalid_request_error")) {
    return `Sorry — the request was rejected by the API. Please try again in 5 minutes. ${SLACK_FALLBACK}`;
  }

  return raw || "Unknown error";
}

// Pull the og:image (or twitter:image) from a website's HTML. The model's
// best guess at a hero_image_url is unreliable, so after research finishes
// we fetch the hotel's own homepage and look up its social-preview image,
// which is exactly the asset we want to show at the top of the dossier.
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
    const html = (await res.text()).slice(0, 200_000); // cap: <head> is always near the top
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
        // Resolve protocol-relative and root-relative URLs.
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

/** The web_search tool sometimes wraps grounded quotes in
 *  <cite index="...">...</cite> markup that leaks into the JSON string
 *  values. Strip the tags everywhere in the raw output so the dossier
 *  reads cleanly. */
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

export async function POST(req: NextRequest) {
  const { hotelName, city, country } = await req.json();

  if (!hotelName || !city || !country) {
    return new Response(
      JSON.stringify({ error: "hotelName, city and country are required" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
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

      // Proxy-defeating padding — some edges buffer the first few KB before
      // flushing. A 2KB comment guarantees a prompt flush.
      safeEnqueue(encoder.encode(`: ${" ".repeat(2048)}\n\n`));

      // Keep the connection alive and force periodic flushes through any
      // buffering proxy. If nothing has happened for >5s, surface a visible
      // "still working" log so the user sees activity.
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
          message: `Starting deep research on "${hotelName}" (${city}, ${country})`,
          t: elapsed(),
        });

        const client = new Anthropic();

        const userPrompt = `Research this hotel and return the full dossier as a single JSON object.

Hotel: ${hotelName}
City: ${city}
Country: ${country}

Cover everything the schema asks for: website, property profile, services (F&B, spa, events/MICE), reputation (review ratings + recurring themes), key challenges tied to review evidence, named contacts for outreach, tech-stack signals, and a tailored Mews positioning. Include source URLs.

Return only the JSON object, no prose, no code fences.`;

        const stream = client.messages.stream({
          // Haiku 4.5 — cheapest per-token model capable of grounded hotel
          // research. Combined with prompt caching on the (large) system
          // prompt and a capped number of web searches this keeps the
          // per-run cost in the single-digit-cents range.
          model: "claude-haiku-4-5",
          // 8000 fits comfortably now that themes/challenges are capped
          // (3+3 themes × 2 short quotes + 4 challenges × 2 short quotes
          // ≈ 20 quotes ≈ 1.5KB) and the bulk of the budget can go to
          // the qualification + positioning sections.
          max_tokens: 8000,
          system: [
            {
              type: "text",
              text: SYSTEM_PROMPT,
              cache_control: { type: "ephemeral" },
            },
          ],
          tools: [
            {
              type: "web_search_20250305",
              name: "web_search",
              max_uses: 5,
            } as unknown as Anthropic.Messages.ToolUnion,
          ],
          messages: [{ role: "user", content: userPrompt }],
        });

        let currentBlockType: string | null = null;
        let toolInputBuffer = "";
        let textCharsEmittedAt = 0;
        let textCharCount = 0;
        let searchCount = 0;

        for await (const event of stream) {
          const e = event as {
            type: string;
            content_block?: { type: string; name?: string; content?: unknown };
            delta?: {
              type: string;
              thinking?: string;
              partial_json?: string;
              text?: string;
            };
          };

          switch (e.type) {
            case "content_block_start": {
              const block = e.content_block;
              if (!block) break;
              currentBlockType = block.type;
              toolInputBuffer = "";

              if (block.type === "thinking") {
                send({
                  type: "log",
                  level: "think",
                  message: "Claude is thinking…",
                  t: elapsed(),
                });
              } else if (block.type === "web_search_tool_result") {
                const content = block.content;
                if (Array.isArray(content)) {
                  send({
                    type: "log",
                    level: "result",
                    message: `Got ${content.length} result${content.length !== 1 ? "s" : ""}`,
                    t: elapsed(),
                    results: content
                      .slice(0, 5)
                      .map((r: { title?: string; url?: string }) => ({
                        title: r.title,
                        url: r.url,
                      })),
                  });
                } else if (
                  content &&
                  typeof content === "object" &&
                  "error_code" in (content as Record<string, unknown>)
                ) {
                  send({
                    type: "log",
                    level: "warn",
                    message: `Search error: ${(content as { error_code: string }).error_code}`,
                    t: elapsed(),
                  });
                }
              } else if (block.type === "text") {
                send({
                  type: "log",
                  level: "compose",
                  message: "Composing dossier JSON…",
                  t: elapsed(),
                });
                textCharCount = 0;
                textCharsEmittedAt = 0;
              }
              break;
            }
            case "content_block_delta": {
              const delta = e.delta;
              if (!delta) break;
              if (delta.type === "thinking_delta" && delta.thinking) {
                send({ type: "thinking", text: delta.thinking });
              } else if (
                delta.type === "input_json_delta" &&
                delta.partial_json
              ) {
                toolInputBuffer += delta.partial_json;
              } else if (delta.type === "text_delta" && delta.text) {
                textCharCount += delta.text.length;
                if (textCharCount - textCharsEmittedAt > 1000) {
                  textCharsEmittedAt = textCharCount;
                  send({
                    type: "log",
                    level: "compose",
                    message: `…${textCharCount.toLocaleString()} chars written`,
                    t: elapsed(),
                  });
                }
              }
              break;
            }
            case "content_block_stop": {
              if (currentBlockType === "server_tool_use" && toolInputBuffer) {
                try {
                  const parsed = JSON.parse(toolInputBuffer);
                  if (parsed && typeof parsed.query === "string") {
                    searchCount += 1;
                    send({
                      type: "log",
                      level: "search",
                      message: `Search #${searchCount}: ${parsed.query}`,
                      t: elapsed(),
                    });
                  }
                } catch {
                  // partial JSON, ignore
                }
              }
              currentBlockType = null;
              break;
            }
            case "message_stop": {
              send({
                type: "log",
                level: "done",
                message: "Model finished — parsing JSON…",
                t: elapsed(),
              });
              break;
            }
          }
        }

        const finalMessage = await stream.finalMessage();

        const text = finalMessage.content
          .filter((b): b is Anthropic.TextBlock => b.type === "text")
          .map((b) => b.text)
          .join("\n");

        if (!text) {
          send({
            type: "error",
            error:
              "Claude returned no text. Stop reason: " +
              finalMessage.stop_reason,
          });
          finish();
          return;
        }

        let dossier: unknown;
        try {
          dossier = extractJson(text);
        } catch {
          send({
            type: "error",
            error: "Failed to parse JSON from model",
            raw: text,
          });
          finish();
          return;
        }

        // Enrich the dossier with a real hero image pulled from the hotel's
        // own site (og:image / twitter:image). This is far more reliable than
        // asking the model to guess a URL.
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
          usage: finalMessage.usage,
          elapsed: elapsed(),
        });
        finish();
      } catch (err) {
        const raw = err instanceof Error ? err.message : String(err);
        const friendly = friendlyApiError(err);
        send({ type: "error", error: friendly, raw });
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
