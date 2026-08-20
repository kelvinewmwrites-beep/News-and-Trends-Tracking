"use client";

import { relativeTime } from "@/lib/format";

interface Props {
  totalArticles: number;
  lastIngestAt: string | null;
  onRefresh: () => void;
  refreshing: boolean;
}

export default function StatusBar({ totalArticles, lastIngestAt, onRefresh, refreshing }: Props) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center gap-4">
        <span className="flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          Live tracking
        </span>
        <span>{totalArticles} articles tracked</span>
        <span>Last refreshed {lastIngestAt ? relativeTime(lastIngestAt) : "never"}</span>
      </div>
      <button
        onClick={onRefresh}
        disabled={refreshing}
        className="rounded-md border border-zinc-200 px-2.5 py-1 font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
      >
        {refreshing ? "Refreshing…" : "Refresh now"}
      </button>
    </div>
  );
}
