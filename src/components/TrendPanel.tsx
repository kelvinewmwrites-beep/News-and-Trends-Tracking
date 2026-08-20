"use client";

import type { TrendReport } from "@/lib/trends";

interface Props {
  report: TrendReport | null;
  loading: boolean;
}

export default function TrendPanel({ report, loading }: Props) {
  const maxCount = report?.keywords.reduce((m, k) => Math.max(m, k.count), 0) ?? 0;

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          Trending topics
        </h2>
        {report && (
          <span className="text-xs text-zinc-400">
            {report.articleCount} articles · last {report.windowDays}d
          </span>
        )}
      </div>

      {loading && !report && (
        <p className="mt-3 text-xs text-zinc-500">Computing trends…</p>
      )}

      {report && report.keywords.length === 0 && (
        <p className="mt-3 text-xs text-zinc-500">
          Not enough tracked news yet to detect trends.
        </p>
      )}

      <ul className="mt-3 flex flex-col gap-1.5">
        {report?.keywords.map((k) => (
          <li key={k.term} className="flex items-center gap-2">
            <div className="flex-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium capitalize text-zinc-700 dark:text-zinc-200">
                  {k.term}
                  {k.rising && (
                    <span className="ml-1.5 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">
                      ▲ rising
                    </span>
                  )}
                </span>
                <span className="tabular-nums text-zinc-400">{k.count}</span>
              </div>
              <div className="mt-0.5 h-1.5 w-full rounded-full bg-zinc-100 dark:bg-zinc-800">
                <div
                  className="h-1.5 rounded-full bg-zinc-900 dark:bg-zinc-300"
                  style={{ width: `${maxCount ? (k.count / maxCount) * 100 : 0}%` }}
                />
              </div>
            </div>
          </li>
        ))}
      </ul>

      {report && report.topSources.length > 0 && (
        <div className="mt-4 border-t border-zinc-100 pt-3 dark:border-zinc-800">
          <h3 className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Top sources</h3>
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {report.topSources.map((s) => (
              <li
                key={s.source}
                className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
              >
                {s.source} · {s.count}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
