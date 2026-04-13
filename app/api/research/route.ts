import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { HOTEL_RESEARCH_SCHEMA } from "@/lib/schema";

// Deep research runs can take a while — allow up to 5 minutes on Vercel.
export const maxDuration = 300;
export const runtime = "nodejs";

const SYSTEM_PROMPT = `You are a hospitality-industry research analyst working for Muse, a SaaS platform that helps hotels streamline their commercial and operational workflows.

Your job: given a hotel name, city and country, produce a deep, accurate dossier the Muse sales team can bring into a first call.

How to work:
1. Use web_search aggressively. Start with the hotel's own website, then Google reviews, TripAdvisor, Booking.com, Hotels.com, LinkedIn (for named contacts), trade press (Hotel Management, Skift, Hospitality Net), and the parent brand site if any.
2. Prefer primary sources. Cite every non-obvious fact with a URL in the "sources" array.
3. Never fabricate contacts, emails or ADR numbers. If something isn't publicly available, omit the field or mark it as "not publicly disclosed".
4. For ADR / occupancy, if no public figure exists, give a reasoned estimate based on segment + market + published rate ranges, and label it clearly as an estimate.
5. For challenges, ground them in actual review themes, segment realities or recent news — not generic hotel problems.
6. For "muse_positioning", be specific to THIS hotel's situation. No generic sales fluff.
7. Do at least 6–10 targeted web searches before composing the final answer.

OUTPUT FORMAT (critical):
Return a single JSON object — and NOTHING ELSE. No prose before or after. No markdown code fences. The object MUST conform to this JSON schema:

${JSON.stringify(HOTEL_RESEARCH_SCHEMA, null, 2)}`;

// Attempt to salvage a JSON object from a response that may be wrapped in
// markdown fences or surrounded by prose.
function extractJson(text: string): unknown {
  // Try direct parse first.
  try {
    return JSON.parse(text);
  } catch {
    // continue
  }

  // Strip markdown code fences.
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) {
    try {
      return JSON.parse(fenced[1]);
    } catch {
      // continue
    }
  }

  // Find the outermost {...} block.
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
  try {
    const { hotelName, city, country } = await req.json();

    if (!hotelName || !city || !country) {
      return NextResponse.json(
        { error: "hotelName, city and country are required" },
        { status: 400 },
      );
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY is not configured on the server" },
        { status: 500 },
      );
    }

    const client = new Anthropic();

    const userPrompt = `Research this hotel and return the full dossier as a single JSON object.

Hotel: ${hotelName}
City: ${city}
Country: ${country}

Cover everything the schema asks for: website, property profile, services (F&B, spa, events/MICE), reputation (review ratings + recurring themes), key challenges tied to review evidence, named contacts for outreach, tech-stack signals, and a tailored Muse positioning. Include source URLs.

Return only the JSON object, no prose, no code fences.`;

    const stream = client.messages.stream({
      model: "claude-opus-4-6",
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      system: SYSTEM_PROMPT,
      tools: [
        {
          type: "web_search_20250305",
          name: "web_search",
          max_uses: 12,
        } as unknown as Anthropic.Messages.ToolUnion,
      ],
      messages: [{ role: "user", content: userPrompt }],
    });

    const finalMessage = await stream.finalMessage();

    // Concatenate all text blocks — web_search responses can include multiple.
    const text = finalMessage.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");

    if (!text) {
      return NextResponse.json(
        {
          error:
            "Claude returned no text. Stop reason: " + finalMessage.stop_reason,
        },
        { status: 502 },
      );
    }

    let dossier: unknown;
    try {
      dossier = extractJson(text);
    } catch {
      return NextResponse.json(
        { error: "Failed to parse JSON from model", raw: text },
        { status: 502 },
      );
    }

    return NextResponse.json({
      dossier,
      usage: finalMessage.usage,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
