import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { HOTEL_RESEARCH_SCHEMA } from "@/lib/schema";

// Deep research runs can take a while — allow up to 5 minutes on Vercel.
export const maxDuration = 300;
export const runtime = "nodejs";

const SYSTEM_PROMPT = `You are a hospitality-industry research analyst working for Mews, a SaaS platform that helps hotels streamline their commercial and operational workflows.

Your job: given a hotel name, city and country, produce a deep, accurate dossier the Mews sales team can bring into a first call.

## Mews Payments — a strategic differentiator you must weaponise

Mews Payments is one of Mews's strongest competitive moats. Whenever review complaints, segment realities or operational signals even *partially* involve money movement, you MUST flag the corresponding key_challenges entry with \`payment_related: true\` and craft a mews_angle that names the specific Mews Payments capability that solves it.

Capabilities to draw on:
- Embedded, automated payments native to the PMS (no third-party gateway bolt-on).
- Automated prepayments, deposits and pre-authorisations — kills no-shows and last-minute payment friction at check-in.
- Payment links sent to guests for remote booking payment — great for events / MICE and corporate bookings.
- Online check-in with pay-in-flow — removes the card-swipe queue at reception.
- Multi-currency processing and automatic FX conversion for international guests.
- Full POS integration — restaurant, bar, spa and room charges land on a single folio.
- PCI-compliant tokenisation; 3D Secure 2 / PSD2 SCA built in.
- Chargeback protection: automatic dispute notification, evidence-submission support, and a Mews Support team that handles disputes on the hotel's behalf — materially lowers write-offs.
- Automated reconciliation: payments auto-match to reservations/folios, cutting end-of-day finance work.

Complaint / signal patterns that should trigger \`payment_related: true\`:
- Slow / confusing check-in or check-out (often a payment-friction issue).
- Chargebacks, billing disputes, "was charged twice", "card declined".
- Manual invoicing, slow refunds, "had to chase for refund".
- No-shows / last-minute cancellations (prepayment problem).
- Corporate/MICE clients frustrated by manual bank transfers or invoicing.
- Split folios, tipping, currency surprises, POS charges not showing up on the final bill.
- Card-on-file security concerns, re-entering card at every outlet.

When writing mews_angle for a payment_related challenge, be specific — name the feature (e.g. "Automated pre-authorisations triggered at booking", "Chargeback protection with Mews-handled dispute submission", "Multi-currency settlement") rather than saying "Mews Payments can help".

How to work:
1. Use web_search aggressively. Start with the hotel's own website, then Google reviews, TripAdvisor, Booking.com, Hotels.com, LinkedIn (for named contacts), trade press (Hotel Management, Skift, Hospitality Net), and the parent brand site if any.
2. Prefer primary sources. Cite every non-obvious fact with a URL in the "sources" array.
3. Never fabricate contacts, emails, LinkedIn URLs or ADR numbers. For contact emails and LinkedIn URLs follow the 95% rule strictly: only include the field when you're ≥95% confident. If you found the exact string on a public page, set email_confidence / linkedin_confidence to "verified". If you derived it from a naming pattern (e.g. firstname.lastname@hoteldomain.com) and it's still plausible, include it and mark it "guessed" — the UI will visibly label these so the salesperson knows to double-check. If you're below 95% confident, OMIT the field completely — do not emit a plausible placeholder. Never invent a source URL that you didn't actually visit.
4. For ADR / occupancy, if no public figure exists, give a reasoned estimate based on segment + market + published rate ranges, and label it clearly as an estimate.
5. For challenges, ground them in actual review themes, segment realities or recent news — not generic hotel problems.
6. For "mews_positioning", be specific to THIS hotel's situation. No generic sales fluff.
7. Do at least 6–10 targeted web searches before composing the final answer.
8. Always try to find ONE good hero image URL (hotel.hero_image_url): look for an og:image on the hotel's own homepage, a Booking.com / Expedia / brand-CDN photo URL, or a press-kit image. Paste the direct image URL (must end in .jpg / .jpeg / .png / .webp or return an image). If you cannot verify one, omit the field — do not invent URLs.
9. Always write a 1–2 sentence "tldr" for hotel.tldr — a crisp, journalist-style headline summary that a salesperson can read in 5 seconds.

OUTPUT FORMAT (critical):
Return a single JSON object — and NOTHING ELSE. No prose before or after. No markdown code fences. The object MUST conform to this JSON schema:

${JSON.stringify(HOTEL_RESEARCH_SCHEMA, null, 2)}`;

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

function extractJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    // continue
  }
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) {
    try {
      return JSON.parse(fenced[1]);
    } catch {
      // continue
    }
  }
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first !== -1 && last > first) {
    try {
      return JSON.parse(text.slice(first, last + 1));
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
          // Haiku 4.5 is ~3× cheaper than Sonnet on tokens and is plenty
          // capable for web-grounded hotel research. Combined with prompt
          // caching on the (large) system prompt and a capped number of
          // web searches this keeps the per-run cost in the single-digit-
          // cents range.
          model: "claude-haiku-4-5",
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
        const message = err instanceof Error ? err.message : String(err);
        send({ type: "error", error: message });
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
