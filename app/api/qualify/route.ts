import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

// Bulk qualification is run row-by-row from the /bulk page. Each run is
// much lighter than the full dossier: fewer searches, smaller output,
// and only the `mews_qualification` shape is returned.
export const maxDuration = 120;
export const runtime = "nodejs";

const QUALIFY_SCHEMA = {
  type: "object",
  properties: {
    hotel: {
      type: "object",
      properties: {
        name: { type: "string" },
        city: { type: "string" },
        country: { type: "string" },
        website: { type: "string" },
        segment: { type: "string" },
        number_of_rooms: { type: "string" },
      },
      required: ["name"],
      additionalProperties: false,
    },
    qualification: {
      type: "object",
      properties: {
        segment: {
          type: "string",
          description:
            "One of: 'Boutique & lifestyle', 'Aparthotel / serviced apartments / long-stay', 'Hostels & budget', 'Resorts & leisure', 'Chain / multi-property (MMP)', 'General'.",
        },
        verdict: {
          type: "string",
          enum: [
            "🟩 strong fit",
            "🟨 limited fit",
            "🟥 poor fit",
            "needs more discovery",
          ],
        },
        rationale: {
          type: "string",
          description:
            "1–2 sentences naming the concrete facts that drove the call (room count, segment, market, key signals).",
        },
      },
      required: ["verdict", "rationale"],
      additionalProperties: false,
    },
  },
  required: ["hotel", "qualification"],
  additionalProperties: false,
} as const;

const QUALIFY_SYSTEM_PROMPT = `You are a hospitality-industry research analyst qualifying hotel leads for Mews, a cloud-native Hospitality Cloud (PMS + Payments + ecosystem).

Your job: given a hotel name, city and country, decide in ONE or TWO quick web searches whether this property is a 🟩 strong fit, 🟨 limited fit, 🟥 poor fit, or 'needs more discovery' for Mews ICP.

## Mews ICP (apply in this order)
🟩 Strong fit: 20–400 rooms (if group) or 20–200 rooms (if individual); independent or 3–20 property groups; urban / city-centre / airport / metro; economy–upscale; Europe (UK, DACH, FR, ES, NL, IT, CH, CZ, PL, Nordics, IE, PT). NA / Singapore / AU / NZ are expanding yellow-fit markets.
🟨 Limited fit: 200+ room resorts, upper-upscale branded, suburban, moderate market fit.
🟥 Poor fit: 800+ rooms, luxury resorts, casinos, all-inclusive, rural/remote, ultra-luxury bespoke, markets like Brazil / Mexico / India / Thailand / Indonesia / China / Japan / Korea / Saudi Arabia / South Africa.

## Segment cheat-sheet — pick exactly one
- "Boutique & lifestyle": small independent / lifestyle properties, F&B-heavy, guest-experience focus.
- "Aparthotel / serviced apartments / long-stay": recurring monthly billing, self-check-in, corporate invoicing.
- "Hostels & budget": bed-level inventory, dorms, group bookings, staffless ops.
- "Resorts & leisure": packages (all-inclusive / half board), activity bundles, spa + F&B outlets, per-day product inventory.
- "Chain / multi-property (MMP)": 3+ properties, central user rights, pooled inventory, staged rollout.
- "General": anything that doesn't cleanly fit the above — typical urban full-service hotel.

## Cross-segment hard stops (force 🟥 poor fit)
1. 800+ rooms
2. Luxury resort / casino / all-inclusive / ultra-luxury bespoke
3. Hotel in an unsupported market (BR / MX / IN / TH / ID / CN / JP / KR / SA / ZA)
4. Rural / remote with no cloud-native operations
5. Rate mixing inside a single reservation, doorlock vendors requiring PINs stored in the PMS, or other deal-breakers from the Mews playbook

## How to work
1. Use web_search at most TWICE — this is a bulk run, keep it fast and cheap.
   - Search 1: the hotel's own website + room count + segment.
   - Search 2 (optional, only if truly needed): quick check on country / ownership / chain context if search 1 didn't give you enough.
2. Never fabricate room counts or segment. If the site doesn't publish a room count, estimate from visible signals (room types, photos, size) and say so in the rationale. If you really cannot tell, return 'needs more discovery'.
3. Be honest when the hotel is 🟥 — don't force-fit.

## Output format (critical)
Return a single JSON object — and NOTHING ELSE. No prose before or after. No markdown code fences. Never wrap values in <cite> tags. The object MUST conform to this JSON schema:

${JSON.stringify(QUALIFY_SCHEMA, null, 2)}`;

const client = new Anthropic();

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
    // fall through
  }
  const fenced = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) {
    try {
      return JSON.parse(fenced[1]);
    } catch {
      // fall through
    }
  }
  const first = cleaned.indexOf("{");
  const last = cleaned.lastIndexOf("}");
  if (first !== -1 && last > first) {
    return JSON.parse(cleaned.slice(first, last + 1));
  }
  throw new Error("Could not extract JSON from model response");
}

export async function POST(req: NextRequest) {
  let body: { hotelName?: string; city?: string; country?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { hotelName, city, country } = body;

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

  const userPrompt = `Qualify this hotel lead and return the verdict as a single JSON object.

Hotel: ${hotelName}
City: ${city}
Country: ${country}

Return only the JSON object, no prose, no code fences.`;

  try {
    const msg = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 1500,
      system: [
        {
          type: "text",
          text: QUALIFY_SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      tools: [
        {
          type: "web_search_20250305",
          name: "web_search",
          max_uses: 2,
        } as unknown as Anthropic.Messages.ToolUnion,
      ],
      messages: [{ role: "user", content: userPrompt }],
    });

    const text = msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");

    if (!text) {
      return new Response(
        JSON.stringify({
          error: `Claude returned no text (stop_reason: ${msg.stop_reason})`,
        }),
        { status: 502, headers: { "Content-Type": "application/json" } },
      );
    }

    let parsed: unknown;
    try {
      parsed = extractJson(text);
    } catch {
      return new Response(
        JSON.stringify({ error: "Failed to parse JSON from model", raw: text }),
        { status: 502, headers: { "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ ...(parsed as object), usage: msg.usage }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
