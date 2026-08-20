import { db } from "./db";
import { isSegmentId, type SegmentId } from "./segments";
import { rowToArticle, type Article, type ArticleRow } from "./types";

export interface ListArticlesOptions {
  segment?: SegmentId | "all";
  days?: number;
  q?: string;
  limit?: number;
  offset?: number;
}

export interface ListArticlesResult {
  articles: Article[];
  total: number;
}

export function listArticles(opts: ListArticlesOptions = {}): ListArticlesResult {
  const { segment = "all", days = 30, q, limit = 30, offset = 0 } = opts;

  const clauses: string[] = [];
  const params: (string | number)[] = [];

  if (segment !== "all" && isSegmentId(segment)) {
    clauses.push(`segments LIKE ?`);
    params.push(`%"${segment}"%`);
  }

  const since = new Date(Date.now() - days * 86400_000).toISOString();
  clauses.push(`(published_at >= ? OR (published_at IS NULL AND fetched_at >= ?))`);
  params.push(since, since);

  if (q && q.trim()) {
    clauses.push(`(title LIKE ? OR snippet LIKE ?)`);
    const like = `%${q.trim()}%`;
    params.push(like, like);
  }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

  const total = (
    db.prepare(`SELECT COUNT(*) as c FROM articles ${where}`).get(...params) as { c: number }
  ).c;

  const rows = db
    .prepare(
      `SELECT * FROM articles ${where} ORDER BY COALESCE(published_at, fetched_at) DESC LIMIT ? OFFSET ?`
    )
    .all(...params, limit, offset) as ArticleRow[];

  return { articles: rows.map(rowToArticle), total };
}

export function getArticlesByIds(ids: number[]): Article[] {
  if (ids.length === 0) return [];
  const placeholders = ids.map(() => "?").join(",");
  const rows = db
    .prepare(`SELECT * FROM articles WHERE id IN (${placeholders})`)
    .all(...ids) as ArticleRow[];
  return rows.map(rowToArticle);
}

export function countArticlesBySegment(): Record<string, number> {
  const rows = db.prepare(`SELECT segments FROM articles`).all() as { segments: string }[];
  const counts: Record<string, number> = {};
  for (const row of rows) {
    const segs = JSON.parse(row.segments) as string[];
    for (const s of segs) counts[s] = (counts[s] ?? 0) + 1;
  }
  return counts;
}
