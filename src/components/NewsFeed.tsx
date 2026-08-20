"use client";

import { SEGMENT_MAP } from "@/lib/segments";
import { relativeTime } from "@/lib/format";
import type { Article } from "@/lib/types";

interface Props {
  articles: Article[];
  loading: boolean;
  query: string;
  onQueryChange: (q: string) => void;
  hasMore: boolean;
  onLoadMore: () => void;
  loadingMore: boolean;
}

export default function NewsFeed({
  articles,
  loading,
  query,
  onQueryChange,
  hasMore,
  onLoadMore,
  loadingMore,
}: Props) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          Tracked news
        </h2>
        <input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Filter headlines..."
          className="w-48 rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-500"
        />
      </div>

      {loading && articles.length === 0 && (
        <div className="rounded-lg border border-dashed border-zinc-200 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700">
          Loading tracked news…
        </div>
      )}

      {!loading && articles.length === 0 && (
        <div className="rounded-lg border border-dashed border-zinc-200 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700">
          No articles yet. Hit &ldquo;Refresh now&rdquo; to pull the latest Singapore news for this
          segment.
        </div>
      )}

      <ul className="flex flex-col gap-2.5">
        {articles.map((article) => (
          <li
            key={article.id}
            className="rounded-lg border border-zinc-200 bg-white p-3.5 transition-shadow hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
          >
            <a
              href={article.link}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium leading-snug text-zinc-900 hover:underline dark:text-zinc-100"
            >
              {article.title}
            </a>
            {article.snippet && (
              <p className="mt-1 line-clamp-2 text-xs text-zinc-500 dark:text-zinc-400">
                {article.snippet}
              </p>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-zinc-400">
              {article.source && <span className="font-medium text-zinc-500 dark:text-zinc-400">{article.source}</span>}
              <span>·</span>
              <span>{relativeTime(article.publishedAt ?? article.fetchedAt)}</span>
              <span className="flex flex-wrap gap-1">
                {article.segments.map((segId) => {
                  const seg = SEGMENT_MAP[segId];
                  if (!seg) return null;
                  return (
                    <span
                      key={segId}
                      className="rounded-full px-1.5 py-0.5 text-[10px] font-medium text-white"
                      style={{ backgroundColor: seg.color }}
                    >
                      {seg.shortLabel}
                    </span>
                  );
                })}
              </span>
            </div>
          </li>
        ))}
      </ul>

      {hasMore && (
        <button
          onClick={onLoadMore}
          disabled={loadingMore}
          className="mt-1 self-center rounded-md border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          {loadingMore ? "Loading…" : "Load more"}
        </button>
      )}
    </div>
  );
}
