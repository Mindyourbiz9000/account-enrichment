import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { HOTEL_RESEARCH_SCHEMA } from "@/lib/schema";

// Deep research runs can take a while — allow up to 5 minutes on Vercel.
export const maxDuration = 300;
export const runtime = "nodejs";

const SYSTEM_PROMPT = `You are a hospitality-industry research analyst working for Mews, a SaaS platform that helps hotels streamline their commercial and operational workflows.

Your job: given a hotel name, city and country, produce a deep, accurate dossier the Mews sales team can bring into a first call.

## Mews playbook primer (sourced from internal Confluence — use this BEFORE you web-search)

You have been pre-briefed on Mews's current (2026) sales playbook. Ground every mews_angle, opening_hook, value-prop and discovery question in this material. Do NOT spend web-search budget learning what Mews does — spend it on the HOTEL.

### Mews Payments — four positioning pillars (Section #4 Messaging Framework)
Whenever review complaints, segment realities or operational signals even *partially* touch money movement, flag the key_challenges entry with \`payment_related: true\` and map the mews_angle to ONE of these four pillars:

1. **Drive revenue.** Collect payments before arrival, upsell with saved-card frictionless upgrades, recover no-show revenue via automatic prepayment, Payment Requests/links for remote booking payment, self-service kiosk.
2. **Accelerate cash-flow.** Daily payouts, real-time reporting, automated reconciliation, and Flexible Financing by YouLend for eligible properties (no collateral, no fixed repayment terms).
3. **Reduce costs.** Embedded payments remove third-party gateway fees, automation cuts manual reconciliation work, built-in fraud prevention + chargeback protection + tokenisation reduce write-offs.
4. **Build trust / security.** PCI DSS certified, PSD2-compliant, end-to-end encryption, tokenisation, Mews as single point of contact, vendor consolidation.

Approved elevator pitch: "Mews Payments is a fully embedded payment solution within the Mews Hospitality Cloud that unifies online and in-person payments across the entire guest journey. By automating payment capture, reconciliation, and reporting, it helps hotels save time, reduce risk, and unlock new revenue."

### Signals that should trigger \`payment_related: true\`
Slow / confusing check-in or check-out; chargebacks; "was charged twice"; "card declined"; manual invoicing; slow refunds; no-shows / last-minute cancellations; corporate/MICE friction with bank transfers; split folios; tipping; currency surprises; POS charges missing from the folio; card-on-file security concerns; OTA virtual card (VCC) reconciliation pain.

### Other Mews product lines — use when signals match
- **Guest Portal** (web, no app): online registration + ID capture + e-signature, pre-arrival payments/pre-auth, digital keys, messaging, express check-out, in-stay upsells. Pitch when reviews mention "long check-in queues", "front desk stressed", "no digital key", "wanted to skip reception", or when the property is select/limited-service, urban, high-throughput.
- **Accounting & Billing Intelligence**: live Deposit / Guest / City ledgers that move automatically with the guest journey, immutable daily Trial Balance (locked PDF/Excel with taxes split from revenue), Routing Rules (who-pays-what for guest vs company vs group), automatic settlement payment routing (OTA VCCs land on the company bill not the guest), monthly invoicing for long stays, bulk dunning/statements. Pitch when signals suggest manual bill-moving, VCC chaos at kiosk, messy group/company billing, long-stay/serviced-apartment cycles, slow month-end close.
- **Mews POS**: unified folio for F&B/bar/spa/room charges. Strong fit: bar, casual dining, quick-service, poolside grill, buffet. Weaker fit: tasting menu / wine-pairing rooms.
- **Mews Terminals + Multicurrency**: in-person card terminals + FX for international/EEA guests.
- **Multi-property / Chain**: central reservation management, multi-property booking engine, centralised guest profiles. Pitch against Opera Cloud, Shiji, Apaleo, Stayntouch, Maestro, Guestline when the hotel is part of a 3-50 property group.
- **RMS (Atomize)**: revenue management automation for 20+ room properties with fluctuating demand; fit for urban / high-demand markets, not remote stable-priced resorts.
- **Events (EMS)**: separated meeting rooms, MICE / groups as a meaningful revenue driver but not a wedding-venue / conference-centre specialist.
- **Flexkeeping** (housekeeping): best fit 150+ rooms, Nordics/UK/Benelux/DACH/AU/FR/NA/APAC.

### Mews ICP fit (Consolidated ICP definitions — weight the opening_hook accordingly)
🟩 Strong fit: 20–400 rooms (PMS for groups) or 20–200 rooms (individual); independent or 3–20 property groups; urban / city-centre / airport / metro; economy–upscale; Europe (UK, DACH, FR, ES, NL, IT, CH, CZ, PL, Nordics, IE, PT), with NA/Singapore/AU/NZ as expanding yellow-fit markets.
🟨 Limited fit: 200+ room resorts, upper-upscale branded, suburban, moderate PMF.
🟥 Poor fit: 800+ rooms, luxury resorts, casinos, all-inclusive, rural/remote, ultra-luxury bespoke, markets like Brazil / Mexico / India / Thailand / Indonesia / CN / JP / KR / SA / ZA.

For a 🟨 or 🟥-fit hotel, be honest about it in the dossier — don't force-fit Mews. Lead with the one product line that DOES fit (e.g. Payments or Guest Portal standalone, or a Multicurrency-only play).

### Discovery approach (Discovery Conversation Guide)
Populate \`mews_positioning.discovery_questions\` using the pain-funnel pattern: surface ("What's the biggest operational headache today?") → reasons ("How long, what have you tried?") → impact ("How much time/money / what does it cost you personally?"). Avoid feature-led yes/no questions. Keep them open and property-specific.

### When writing mews_angle
Name the specific feature — not "Mews can help". E.g. "Automatic settlement payment routing places the OTA virtual card on the company bill so the kiosk stops showing the guest in credit", "Guest Portal handles pre-arrival ID + e-signature + deposit so the reception queue disappears", "Immutable daily Trial Balance gives finance a locked, audit-ready file every morning".

## How to work
1. Use web_search SPARINGLY — you have a hard budget of 3 searches. Pick them carefully:
   - Search 1: the hotel's own website + any obvious reputation source.
   - Search 2: reviews (Google / TripAdvisor / Booking) to find recurring complaint themes.
   - Search 3: people / LinkedIn / parent brand / press for the named contact(s).
   Do NOT waste searches on Mews itself — you already know the playbook above.
2. Prefer primary sources. Cite every non-obvious fact with a URL in the "sources" array.
3. Never fabricate contacts, emails, LinkedIn URLs or ADR numbers. For contact emails and LinkedIn URLs follow the 95% rule strictly: only include the field when you're ≥95% confident. If you found the exact string on a public page, set email_confidence / linkedin_confidence to "verified". If you derived it from a naming pattern (e.g. firstname.lastname@hoteldomain.com) and it's still plausible, include it and mark it "guessed" — the UI will visibly label these so the salesperson knows to double-check. If you're below 95% confident, OMIT the field completely — do not emit a plausible placeholder. Never invent a source URL that you didn't actually visit.
4. For ADR / occupancy, if no public figure exists, give a reasoned estimate based on segment + market + published rate ranges, and label it clearly as an estimate.
5. For challenges, ground them in actual review themes, segment realities or recent news — not generic hotel problems.
6. For "mews_positioning", be specific to THIS hotel's situation and cite the Mews product line by name. No generic sales fluff.
7. Always try to find ONE good hero image URL (hotel.hero_image_url): look for an og:image on the hotel's own homepage, a Booking.com / Expedia / brand-CDN photo URL, or a press-kit image. If you cannot verify one, omit the field — do not invent URLs.
8. Always write a 1–2 sentence "tldr" for hotel.tldr — a crisp, journalist-style headline summary that a salesperson can read in 5 seconds.
9. Be concise. The JSON should be rich but every field should earn its place — no filler.

OUTPUT FORMAT (critical):
Return a single JSON object — and NOTHING ELSE. No prose before or after. No markdown code fences. The object MUST conform to this JSON schema:

${JSON.stringify(HOTEL_RESEARCH_SCHEMA, null, 2)}`;

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
  const lower = (raw + " " + type).toLowerCase();

  // Credit balance is a hard billing issue — no reset time will save us.
  if (
    lower.includes("credit balance") ||
    lower.includes("billing") ||
    lower.includes("quota")
  ) {
    return `Sorry — the Mews research account is out of API credits right now. Please reach out to Thomas Barvaux on Slack to top it up.`;
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
          // Tighter budget to stay under Anthropic's per-minute token + request
          // rate limits. The Confluence-sourced Mews primer in the system
          // prompt (cached) means Claude no longer needs to spend searches or
          // tokens learning what Mews does — so we can safely shrink both
          // max_tokens and max_uses without losing dossier quality.
          max_tokens: 6000,
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
              max_uses: 3,
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
