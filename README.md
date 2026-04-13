# Muse Hotel Intelligence

A Next.js web app that produces a deep research dossier on any hotel for the Muse sales team. Input a hotel name, city, and country — get back contacts, key challenges, services, ADR, reputation signals, tech-stack hints, and Muse-specific positioning.

## How it works

- **Frontend** — `app/page.tsx` collects hotel name / city / country and POSTs to `/api/research`.
- **API route** — `app/api/research/route.ts` calls Claude Opus 4.6 with the `web_search` tool, adaptive thinking, and a JSON-schema-shaped system prompt. It streams the response (to survive long research runs) and parses a single JSON dossier out of the final message.
- **Display** — `components/HotelDossier.tsx` renders the structured dossier.

The schema is defined once in `lib/schema.ts` and reused in both the system prompt and the TypeScript display types.

### Why Claude for deep research?

Claude's `web_search_20250305` server-side tool lets the model run up to 12 targeted searches per request, cite sources, and produce a structured JSON result in a single API call. It's the right fit for "search + synthesize + structure" tasks that would otherwise need an orchestration layer on top of a search engine.

## Setup

```bash
npm install
cp .env.example .env.local
# add your ANTHROPIC_API_KEY
npm run dev
```

Open http://localhost:3000.

## Deploy to Vercel

1. Push this repo to GitHub.
2. Import it in Vercel.
3. Set the `ANTHROPIC_API_KEY` environment variable in the Vercel project settings.
4. Deploy.

The `/api/research` route sets `maxDuration = 300` so Vercel allows up to 5 minutes per request — deep research typically takes 60–180 seconds.

## Environment variables

| Variable            | Required | Description                                   |
| ------------------- | -------- | --------------------------------------------- |
| `ANTHROPIC_API_KEY` | Yes      | Used by the `/api/research` route for Claude. |

## Notes

- The model is instructed never to fabricate contacts, emails, or ADR numbers. If a field isn't publicly available it is omitted or marked as such.
- ADR and occupancy are labeled as estimates when no public figure exists.
- All non-obvious facts should carry a source URL in the `sources` array.
