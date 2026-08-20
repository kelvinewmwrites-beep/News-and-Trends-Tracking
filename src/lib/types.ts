import type { SegmentId } from "./segments";

export interface ArticleRow {
  id: number;
  link: string;
  title: string;
  snippet: string | null;
  source: string | null;
  published_at: string | null;
  fetched_at: string;
  segments: string; // JSON-encoded string[]
}

export interface Article {
  id: number;
  link: string;
  title: string;
  snippet: string | null;
  source: string | null;
  publishedAt: string | null;
  fetchedAt: string;
  segments: SegmentId[];
}

export function rowToArticle(row: ArticleRow): Article {
  return {
    id: row.id,
    link: row.link,
    title: row.title,
    snippet: row.snippet,
    source: row.source,
    publishedAt: row.published_at,
    fetchedAt: row.fetched_at,
    segments: JSON.parse(row.segments) as SegmentId[],
  };
}

export interface ContentIdeaRow {
  id: number;
  segment: string;
  title: string;
  format: string;
  angle: string;
  hook: string;
  source_article_ids: string;
  generator: string;
  created_at: string;
}

export interface ContentIdea {
  id: number;
  segment: SegmentId;
  title: string;
  format: string;
  angle: string;
  hook: string;
  sourceArticleIds: number[];
  generator: "claude" | "template";
  createdAt: string;
}

export function rowToIdea(row: ContentIdeaRow): ContentIdea {
  return {
    id: row.id,
    segment: row.segment as SegmentId,
    title: row.title,
    format: row.format,
    angle: row.angle,
    hook: row.hook,
    sourceArticleIds: JSON.parse(row.source_article_ids) as number[],
    generator: row.generator as "claude" | "template",
    createdAt: row.created_at,
  };
}
