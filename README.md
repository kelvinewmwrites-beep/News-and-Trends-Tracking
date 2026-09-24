# Singapore Business News & Trends Tracker

A real-time news and trends tracking dashboard for Singapore corporate services, covering:

- **Company Incorporation**
- **Corporate Secretary**
- **Grant Advisory**
- **Managed Legal** (DPO, Risk Management, GRC)
- **Accounting & Tax**

It continuously ingests Singapore-focused news for each segment, surfaces trending keywords/topics, and can generate ready-to-use content ideas (blog posts, LinkedIn posts, client newsletters, video scripts, FAQs) from the tracked news.

## How it works

- **Ingestion** (`src/lib/ingest.ts`): pulls Google News RSS results (Singapore edition) for a curated set of search queries per segment (`src/lib/segments.ts`), dedupes articles by URL, and tags each article with every matching segment.
- **Storage** (`src/lib/db.ts`): a local SQLite database (`data/app.db`, via `better-sqlite3`) stores articles, generated content ideas, and an ingest run log.
- **Scheduler** (`src/instrumentation.ts`): on server boot, runs an initial ingest and then re-ingests every `SGNEWS_INGEST_INTERVAL_MIN` minutes (default 15) using `node-cron`. A manual "Refresh now" button in the UI also triggers an ingest (rate-limited to once per 60s).
- **Trends** (`src/lib/trends.ts`): computes trending keywords/phrases per segment over a rolling window, using frequency counting with a rising/falling comparison between the first and second half of the window, plus top sources.
- **Content ideas** (`src/lib/contentIdeas.ts`): given a segment's recent articles, generates content ideas. If `ANTHROPIC_API_KEY` is set, ideas are written by Claude; otherwise a deterministic template-based generator produces ideas so the feature works out of the box with no API key.
- **Dashboard** (`src/components/Dashboard.tsx`): segment tabs, a live-updating news feed (polls every 45s), a trending-topics panel, and a content-idea panel with one-click generation and copy-to-clipboard.

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). On first boot the scheduler kicks off an initial ingest automatically — refresh after a few seconds, or use the "Refresh now" button.

### Environment variables

Copy `.env.example` to `.env.local` and adjust as needed:

| Variable | Default | Purpose |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | _(unset)_ | Enables Claude-generated content ideas. Without it, the template-based generator is used automatically. |
| `CONTENT_IDEA_MODEL` | `claude-sonnet-5` | Model used for content idea generation when `ANTHROPIC_API_KEY` is set. |
| `SGNEWS_INGEST_INTERVAL_MIN` | `15` | Minutes between automatic background ingests. |
| `SGNEWS_DISABLE_SCHEDULER` | _(unset)_ | Set to `1` to disable the background cron scheduler (useful for tests or serverless deployments that trigger ingestion externally). |

### Adding/tuning tracked segments and queries

Edit `src/lib/segments.ts` — each segment has a list of free-text search queries (fed into Google News RSS) and a keyword list used to boost trend relevance and fallback content ideas. Google News ranks plain queries by relevance (mostly older articles), so queries suffixed with `when:30d` are included to keep recent coverage flowing.

To follow a specific publisher (e.g. a corporate-services firm's guides and regulatory explainers), add its domain to `WATCHED_SITES`. Each ingest fetches that site's recent posts once and routes each post to every segment whose `matchTerms` appear in its title; posts matching no segment are skipped and counted as `unmatched` in the ingest result.

## Weekly trends report

[`reports/weekly-trends.md`](reports/weekly-trends.md) summarises the past 7 days per segment: trending terms, the latest on-topic news, and practitioner guides from `WATCHED_SITES`, with links. Each week's report is also kept in `reports/archive/YYYY-MM-DD.md`.

The `Weekly trends report` GitHub Actions workflow regenerates and commits it every Monday at 09:00 SGT (run it anytime from the Actions tab via "Run workflow"). To generate it locally:

```bash
npm run report:weekly
```

This runs a fresh ingest into `data/app.db` first, so it works without the dev server running.

## Deployment notes

- The scheduler in `src/instrumentation.ts` requires a long-lived Node.js process (e.g. a VPS, container, or `next start` on a persistent host). On serverless platforms without persistent processes (e.g. Vercel serverless functions), set `SGNEWS_DISABLE_SCHEDULER=1` and instead call `POST /api/ingest` on a schedule (e.g. Vercel Cron, GitHub Actions, or any external scheduler).
- `data/app.db` is a local SQLite file and is gitignored. On platforms with an ephemeral filesystem, mount a persistent volume for the `data/` directory, or swap `src/lib/db.ts` for a hosted database.
- Outbound network access to `news.google.com` is required for ingestion to succeed — make sure your deployment environment's network/firewall policy allows it.

## API routes

- `GET /api/news?segment=<id|all>&days=&q=&limit=&offset=` — list tracked articles.
- `GET /api/trends?segment=<id|all>&days=` — trending keywords, rising topics, and top sources.
- `GET /api/stats` — per-segment article counts and last ingest info.
- `POST /api/ingest` — manually trigger an ingest (rate-limited to once per 60s). `GET /api/ingest` returns the last ingest run.
- `GET /api/content-ideas?segment=<id>` — list previously generated ideas.
- `POST /api/content-ideas` with `{ "segment": "<id>", "count": 5 }` — generate new content ideas for a segment.

## Tech stack

Next.js (App Router) + TypeScript + Tailwind CSS, `better-sqlite3`, `rss-parser`, `node-cron`, `@anthropic-ai/sdk`.
