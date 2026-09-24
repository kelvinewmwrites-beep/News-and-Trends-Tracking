import Parser from "rss-parser";
import { db } from "./db";
import {
  SEGMENTS,
  WATCHED_SITES,
  matchSegments,
  watchedSiteQuery,
  type SegmentId,
} from "./segments";
import type { ArticleRow } from "./types";

type FeedItem = {
  title?: string;
  link?: string;
  pubDate?: string;
  isoDate?: string;
  contentSnippet?: string;
  content?: string;
  source?: { _?: string; $?: { url?: string } } | string;
};

const parser = new Parser<Record<string, unknown>, FeedItem>({
  customFields: { item: ["source"] },
  timeout: 15000,
  headers: {
    "User-Agent":
      "Mozilla/5.0 (compatible; SGNewsTracker/1.0; +https://example.com/bot)",
  },
});

function googleNewsRssUrl(query: string): string {
  const q = encodeURIComponent(query);
  return `https://news.google.com/rss/search?q=${q}&hl=en-SG&gl=SG&ceid=SG:en`;
}

function splitTitleSource(rawTitle: string): { title: string; source: string | null } {
  const idx = rawTitle.lastIndexOf(" - ");
  if (idx === -1) return { title: rawTitle, source: null };
  return {
    title: rawTitle.slice(0, idx).trim(),
    source: rawTitle.slice(idx + 3).trim(),
  };
}

// Google News titles end with " - <source>"; strip it so publisher names don't pollute trends.
function stripSourceSuffix(title: string, source: string): string {
  const suffix = ` - ${source}`;
  return title.endsWith(suffix) ? title.slice(0, -suffix.length).trim() : title;
}

function extractSource(item: FeedItem, fallbackTitle: string): { title: string; source: string | null } {
  if (typeof item.source === "string" && item.source.trim()) {
    const source = item.source.trim();
    return { title: stripSourceSuffix(fallbackTitle, source), source };
  }
  if (item.source && typeof item.source === "object" && item.source._) {
    const source = item.source._.trim();
    return { title: stripSourceSuffix(fallbackTitle, source), source };
  }
  return splitTitleSource(fallbackTitle);
}

export interface IngestResult {
  newArticles: number;
  updatedArticles: number;
  perSegment: Record<SegmentId, { fetched: number; errors: string[] }>;
  watchedSites: Record<string, { fetched: number; unmatched: number; errors: string[] }>;
  durationMs: number;
}

const upsertStmt = db.prepare<{
  link: string;
  title: string;
  snippet: string | null;
  source: string | null;
  published_at: string | null;
  fetched_at: string;
  segments: string;
}>(`
  INSERT INTO articles (link, title, snippet, source, published_at, fetched_at, segments)
  VALUES (@link, @title, @snippet, @source, @published_at, @fetched_at, @segments)
  ON CONFLICT(link) DO UPDATE SET
    segments = @segments,
    fetched_at = @fetched_at
  WHERE articles.link = @link
`);

const getByLinkStmt = db.prepare<[string]>(`SELECT * FROM articles WHERE link = ?`);

export async function ingestAll(): Promise<IngestResult> {
  const startedAt = Date.now();
  const logStmt = db.prepare(
    `INSERT INTO ingest_log (started_at, new_articles, updated_articles, errors) VALUES (?, 0, 0, NULL)`
  );
  const logInfo = logStmt.run(new Date(startedAt).toISOString());

  let newArticles = 0;
  let updatedArticles = 0;
  const perSegment: Record<string, { fetched: number; errors: string[] }> = {};
  const watchedSites: IngestResult["watchedSites"] = {};
  const allErrors: string[] = [];

  const storeItem = (item: FeedItem, title: string, source: string | null, segmentIds: SegmentId[]) => {
    const existing = getByLinkStmt.get(item.link!) as ArticleRow | undefined;
    const existingSegments: SegmentId[] = existing
      ? (JSON.parse(existing.segments) as SegmentId[])
      : [];

    upsertStmt.run({
      link: item.link!,
      title,
      snippet: item.contentSnippet?.slice(0, 500) ?? null,
      source,
      published_at: item.isoDate ?? item.pubDate ?? null,
      fetched_at: new Date().toISOString(),
      segments: JSON.stringify(Array.from(new Set([...existingSegments, ...segmentIds]))),
    });

    if (existing) {
      updatedArticles += 1;
    } else {
      newArticles += 1;
    }
  };

  for (const segment of SEGMENTS) {
    perSegment[segment.id] = { fetched: 0, errors: [] };

    for (const query of segment.queries) {
      try {
        const feed = await parser.parseURL(googleNewsRssUrl(query));
        for (const item of feed.items ?? []) {
          if (!item.link || !item.title) continue;
          const { title, source } = extractSource(item, item.title);
          storeItem(item, title, source, [segment.id]);
          perSegment[segment.id].fetched += 1;
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        perSegment[segment.id].errors.push(`"${query}": ${message}`);
        allErrors.push(`[${segment.id}] "${query}": ${message}`);
      }
    }
  }

  for (const { domain: site } of WATCHED_SITES) {
    watchedSites[site] = { fetched: 0, unmatched: 0, errors: [] };
    try {
      const feed = await parser.parseURL(googleNewsRssUrl(watchedSiteQuery(site)));
      for (const item of feed.items ?? []) {
        if (!item.link || !item.title) continue;
        const { title, source } = extractSource(item, item.title);
        const segmentIds = matchSegments(title);
        if (segmentIds.length === 0 || /\bArchives?$/i.test(title)) {
          watchedSites[site].unmatched += 1;
          continue;
        }
        storeItem(item, title, source, segmentIds);
        watchedSites[site].fetched += 1;
        for (const id of segmentIds) perSegment[id].fetched += 1;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      watchedSites[site].errors.push(message);
      allErrors.push(`[site:${site}] ${message}`);
    }
  }

  const finishedAt = Date.now();
  db.prepare(
    `UPDATE ingest_log SET finished_at = ?, new_articles = ?, updated_articles = ?, errors = ? WHERE id = ?`
  ).run(
    new Date(finishedAt).toISOString(),
    newArticles,
    updatedArticles,
    allErrors.length ? JSON.stringify(allErrors) : null,
    logInfo.lastInsertRowid
  );

  return {
    newArticles,
    updatedArticles,
    perSegment: perSegment as Record<SegmentId, { fetched: number; errors: string[] }>,
    watchedSites,
    durationMs: finishedAt - startedAt,
  };
}

export function getLastIngest() {
  return db
    .prepare(`SELECT * FROM ingest_log ORDER BY id DESC LIMIT 1`)
    .get() as
    | {
        id: number;
        started_at: string;
        finished_at: string | null;
        new_articles: number;
        updated_articles: number;
        errors: string | null;
      }
    | undefined;
}
