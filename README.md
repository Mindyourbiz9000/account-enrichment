# Mews Hotel Intelligence

A Next.js web app that produces a deep research dossier on any hotel for the Mews sales team. Input a hotel name, city, and country — get back contacts, key challenges, services, ADR, reputation signals, tech-stack hints, and Mews-specific positioning.

## How it works

- **Frontend** — `app/page.tsx` collects hotel name / city / country and offers two research buttons: **Run Deep Search (Claude)** and **Run Deep Search (Perplexity)**.
- **Claude route** — `app/api/research/route.ts` calls Claude Haiku 4.5 with the `web_search` tool and a JSON-schema-shaped system prompt. Streams the response and parses a single JSON dossier.
- **Perplexity route** — `app/api/research-perplexity/route.ts` calls Perplexity's `sonar-pro` model (built-in live web search) with the same system prompt. Also streams and returns the same JSON dossier shape.
- **Display** — `components/HotelDossier.tsx` renders the structured dossier (identical for both providers).
- **Shared prompt** — `lib/researchPrompt.ts` holds the system prompt used by both routes.

The schema is defined once in `lib/schema.ts` and reused in both the system prompt and the TypeScript display types.

## Setup

```bash
npm install
cp .env.example .env.local
# add your ANTHROPIC_API_KEY and PERPLEXITY_API_KEY
npm run dev
```

Open http://localhost:3000.

## Deploy to Vercel

1. Push this repo to GitHub.
2. Import it in Vercel.
3. Set `ANTHROPIC_API_KEY` and `PERPLEXITY_API_KEY` in Vercel project settings.
4. Deploy.

The `/api/research` route sets `maxDuration = 300` so Vercel allows up to 5 minutes per request — deep research typically takes 60–180 seconds.

## Environment variables

| Variable              | Required | Description                                              |
| --------------------- | -------- | -------------------------------------------------------- |
| `ANTHROPIC_API_KEY`   | Yes      | Used by the `/api/research` route (Claude button).       |
| `PERPLEXITY_API_KEY`  | Yes      | Used by the `/api/research-perplexity` route (Perplexity button). Get one at perplexity.ai/settings/api. |

## Notes

- The model is instructed never to fabricate contacts, emails, or ADR numbers. If a field isn't publicly available it is omitted or marked as such.
- ADR and occupancy are labeled as estimates when no public figure exists.
- All non-obvious facts should carry a source URL in the `sources` array.
