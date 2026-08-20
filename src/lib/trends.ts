import { db } from "./db";
import { SEGMENT_MAP, type SegmentId } from "./segments";
import { rowToArticle, type ArticleRow } from "./types";

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "of", "to", "in", "on", "for", "with",
  "as", "by", "at", "from", "is", "are", "was", "were", "be", "been", "being",
  "it", "its", "this", "that", "these", "those", "will", "would", "can",
  "could", "should", "may", "might", "must", "have", "has", "had", "not",
  "no", "yes", "up", "down", "out", "over", "under", "into", "onto", "than",
  "then", "so", "if", "about", "after", "before", "between", "more", "most",
  "new", "news", "says", "said", "say", "how", "what", "when", "where",
  "who", "why", "which", "amid", "amid", "their", "his", "her", "our",
  "your", "you", "we", "they", "he", "she", "singapore", "sg", "s'pore",
  "2024", "2025", "2026",
]);

const TOKEN_RE = /[a-z0-9][a-z0-9'&-]*/g;

function tokenize(text: string): string[] {
  return (text.toLowerCase().match(TOKEN_RE) ?? []).filter(
    (t) => t.length >= 3 && !STOPWORDS.has(t)
  );
}

function bigrams(tokens: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < tokens.length - 1; i++) {
    out.push(`${tokens[i]} ${tokens[i + 1]}`);
  }
  return out;
}

export interface TrendKeyword {
  term: string;
  count: number;
  rising: boolean;
}

export interface TrendReport {
  segment: SegmentId;
  windowDays: number;
  articleCount: number;
  keywords: TrendKeyword[];
  topSources: { source: string; count: number }[];
  volumeByDay: { date: string; count: number }[];
}

function segmentWhereClause() {
  return `segments LIKE ?`;
}

function getArticlesInWindow(segment: SegmentId, days: number): ArticleRow[] {
  const since = new Date(Date.now() - days * 86400_000).toISOString();
  return db
    .prepare(
      `SELECT * FROM articles WHERE ${segmentWhereClause()} AND (published_at >= ? OR (published_at IS NULL AND fetched_at >= ?)) ORDER BY COALESCE(published_at, fetched_at) DESC`
    )
    .all(`%"${segment}"%`, since, since) as ArticleRow[];
}

export function computeTrends(segment: SegmentId, days = 14, topN = 15): TrendReport {
  const rows = getArticlesInWindow(segment, days);
  const articles = rows.map(rowToArticle);
  const segmentDef = SEGMENT_MAP[segment];

  const midpoint = Date.now() - (days / 2) * 86400_000;
  const counts = new Map<string, number>();
  const recentCounts = new Map<string, number>();
  const olderCounts = new Map<string, number>();
  const sourceCounts = new Map<string, number>();
  const dayCounts = new Map<string, number>();

  for (const article of articles) {
    const text = `${article.title} ${article.snippet ?? ""}`;
    const unigrams = tokenize(text);
    const phrases = [...unigrams, ...bigrams(unigrams)];
    const when = article.publishedAt ?? article.fetchedAt;
    const isRecent = new Date(when).getTime() >= midpoint;
    const seen = new Set<string>();
    for (const term of phrases) {
      if (seen.has(term)) continue; // count each article once per term
      seen.add(term);
      counts.set(term, (counts.get(term) ?? 0) + 1);
      const bucket = isRecent ? recentCounts : olderCounts;
      bucket.set(term, (bucket.get(term) ?? 0) + 1);
    }

    if (article.source) {
      sourceCounts.set(article.source, (sourceCounts.get(article.source) ?? 0) + 1);
    }

    const day = when.slice(0, 10);
    dayCounts.set(day, (dayCounts.get(day) ?? 0) + 1);
  }

  // Boost segment-relevant keywords slightly so they surface even at lower raw counts.
  const boosted = Array.from(counts.entries()).map(([term, count]) => {
    const isKeyword = segmentDef.keywords.some((k) => term.includes(k) || k.includes(term));
    return { term, count, score: count + (isKeyword ? 1.5 : 0) };
  });

  boosted.sort((a, b) => b.score - a.score || b.count - a.count);

  const keywords: TrendKeyword[] = boosted.slice(0, topN).map(({ term, count }) => {
    const recent = recentCounts.get(term) ?? 0;
    const older = olderCounts.get(term) ?? 0;
    const rising = recent >= 2 && recent > older * 1.5;
    return { term, count, rising };
  });

  const topSources = Array.from(sourceCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([source, count]) => ({ source, count }));

  const volumeByDay = Array.from(dayCounts.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, count]) => ({ date, count }));

  return {
    segment,
    windowDays: days,
    articleCount: articles.length,
    keywords,
    topSources,
    volumeByDay,
  };
}
