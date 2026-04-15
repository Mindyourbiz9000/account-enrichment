import { NextRequest } from "next/server";

// Bulk qualification is run row-by-row from the /bulk page. Each run is
// much lighter than the full dossier: 1-2 quick web searches, smaller output,
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
};

const QUALIFY_SYSTEM_PROMPT = `You are a hospitality-industry research analyst qualifying hotel leads for Mews, a cloud-native Hospitality Cloud (PMS + Payments + ecosystem).

Your job: given a hotel name, city and country, do 1–2 quick web searches to determine whether this property is a 🟩 strong fit, 🟨 limited fit, 🟥 poor fit, or 'needs more discovery' for Mews ICP. Return a single JSON object — nothing else.

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

## How to work
1. Search the hotel's own website to get room count, segment, and location.
2. Only do a second search if context (ownership, chain, market) is unclear from the first.
3. Never fabricate room counts. If unknown, estimate from visible signals and say so in the rationale.
4. Be honest when the hotel is 🟥 — don't force-fit.

Return only the JSON object matching the schema. No prose, no code fences, no \`<cite>\` tags.`;

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

  if (!process.env.PERPLEXITY_API_KEY) {
    return new Response(
      JSON.stringify({
        error: "PERPLEXITY_API_KEY is not configured on the server",
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
    const res = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.PERPLEXITY_API_KEY}`,
      },
      body: JSON.stringify({
        // sonar is the lightweight tier — fast and cost-effective for the
        // 1-2 searches a bulk qualification needs.
        model: "sonar",
        messages: [
          { role: "system", content: QUALIFY_SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        response_format: {
          type: "json_schema",
          json_schema: { schema: QUALIFY_SCHEMA },
        },
        // "low" context is enough for a quick ICP score — we don't need
        // deep review evidence for this pass.
        web_search_options: { search_context_size: "low" },
        max_tokens: 1500,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      let errMsg = `Perplexity API error ${res.status}`;
      try {
        const parsed = JSON.parse(errText);
        if (parsed?.error?.message) errMsg = parsed.error.message;
      } catch {
        // use status message
      }
      if (res.status === 401)
        errMsg =
          "Invalid Perplexity API key — please check PERPLEXITY_API_KEY.";
      else if (res.status === 429)
        errMsg = "Perplexity rate limit reached — please try again shortly.";
      else if (res.status === 402)
        errMsg = "Perplexity account is out of credits.";
      return new Response(JSON.stringify({ error: errMsg }), {
        status: res.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };

    const text = data.choices?.[0]?.message?.content ?? "";
    if (!text) {
      return new Response(
        JSON.stringify({ error: "Perplexity returned no content" }),
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
      JSON.stringify({
        ...(parsed as object),
        usage: {
          input_tokens: data.usage?.prompt_tokens ?? 0,
          output_tokens: data.usage?.completion_tokens ?? 0,
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
