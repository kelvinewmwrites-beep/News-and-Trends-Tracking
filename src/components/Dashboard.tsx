"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import SegmentTabs from "./SegmentTabs";
import NewsFeed from "./NewsFeed";
import TrendPanel from "./TrendPanel";
import ContentIdeaPanel from "./ContentIdeaPanel";
import StatusBar from "./StatusBar";
import { SEGMENTS, type SegmentId } from "@/lib/segments";
import type { Article, ContentIdea } from "@/lib/types";
import type { TrendReport } from "@/lib/trends";

const PAGE_SIZE = 20;
const POLL_MS = 45_000;

interface StatsResponse {
  segments: { id: SegmentId; label: string; count: number }[];
  totalArticles: number;
  lastIngest: { finished_at: string | null } | null;
}

function mergeReports(reports: TrendReport[]): TrendReport {
  const counts = new Map<string, { count: number; rising: boolean }>();
  let articleCount = 0;
  for (const r of reports) {
    articleCount += r.articleCount;
    for (const k of r.keywords) {
      const existing = counts.get(k.term);
      if (existing) {
        existing.count += k.count;
        existing.rising = existing.rising || k.rising;
      } else {
        counts.set(k.term, { count: k.count, rising: k.rising });
      }
    }
  }
  const keywords = Array.from(counts.entries())
    .map(([term, v]) => ({ term, ...v }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);

  const sourceCounts = new Map<string, number>();
  for (const r of reports) {
    for (const s of r.topSources) {
      sourceCounts.set(s.source, (sourceCounts.get(s.source) ?? 0) + s.count);
    }
  }
  const topSources = Array.from(sourceCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([source, count]) => ({ source, count }));

  return {
    segment: "all" as SegmentId,
    windowDays: reports[0]?.windowDays ?? 14,
    articleCount,
    keywords,
    topSources,
    volumeByDay: [],
  };
}

export default function Dashboard() {
  const [activeSegment, setActiveSegment] = useState<SegmentId | "all">("all");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  const [articles, setArticles] = useState<Article[]>([]);
  const [articlesTotal, setArticlesTotal] = useState(0);
  const [loadingArticles, setLoadingArticles] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [trendReport, setTrendReport] = useState<TrendReport | null>(null);
  const [trendLoading, setTrendLoading] = useState(true);

  const [ideas, setIdeas] = useState<ContentIdea[]>([]);
  const [generating, setGenerating] = useState(false);
  const [generatorUsed, setGeneratorUsed] = useState<"claude" | "template" | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 400);
    return () => clearTimeout(t);
  }, [query]);

  const fetchArticles = useCallback(
    async (offset: number, replace: boolean) => {
      if (replace) setLoadingArticles(true);
      else setLoadingMore(true);
      try {
        const params = new URLSearchParams({
          segment: activeSegment,
          limit: String(PAGE_SIZE),
          offset: String(offset),
        });
        if (debouncedQuery) params.set("q", debouncedQuery);
        const res = await fetch(`/api/news?${params}`);
        const data = (await res.json()) as { articles: Article[]; total: number };
        setArticles((prev) => (replace ? data.articles : [...prev, ...data.articles]));
        setArticlesTotal(data.total);
      } finally {
        setLoadingArticles(false);
        setLoadingMore(false);
      }
    },
    [activeSegment, debouncedQuery]
  );

  const fetchStats = useCallback(async () => {
    const res = await fetch("/api/stats");
    const data = (await res.json()) as StatsResponse;
    setStats(data);
  }, []);

  const fetchTrends = useCallback(async () => {
    setTrendLoading(true);
    try {
      const res = await fetch(`/api/trends?segment=${activeSegment}`);
      const data = (await res.json()) as { reports: TrendReport[] };
      if (activeSegment === "all") {
        setTrendReport(mergeReports(data.reports));
      } else {
        setTrendReport(data.reports[0] ?? null);
      }
    } finally {
      setTrendLoading(false);
    }
  }, [activeSegment]);

  const fetchIdeas = useCallback(async () => {
    const params = activeSegment !== "all" ? `?segment=${activeSegment}` : "";
    const res = await fetch(`/api/content-ideas${params}`);
    const data = (await res.json()) as { ideas: ContentIdea[] };
    setIdeas(data.ideas);
  }, [activeSegment]);

  // Initial + on segment/query change
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount/segment-change is the intended data flow here
    fetchArticles(0, true);
    fetchTrends();
    fetchIdeas();
  }, [fetchArticles, fetchTrends, fetchIdeas]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount is the intended data flow here
    fetchStats();
  }, [fetchStats]);

  // Polling for a "real-time" feel.
  const pollRef = useRef({ fetchArticles, fetchStats, fetchTrends });
  useEffect(() => {
    pollRef.current = { fetchArticles, fetchStats, fetchTrends };
  }, [fetchArticles, fetchStats, fetchTrends]);
  useEffect(() => {
    const id = setInterval(() => {
      pollRef.current.fetchArticles(0, true);
      pollRef.current.fetchStats();
      pollRef.current.fetchTrends();
    }, POLL_MS);
    return () => clearInterval(id);
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetch("/api/ingest", { method: "POST" });
    } catch {
      // ignore — polling will pick up whatever succeeded server-side
    } finally {
      await Promise.all([fetchArticles(0, true), fetchStats(), fetchTrends()]);
      setRefreshing(false);
    }
  };

  const handleGenerate = async (segment: SegmentId) => {
    setGenerating(true);
    try {
      const res = await fetch("/api/content-ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ segment, count: 5 }),
      });
      const data = (await res.json()) as { ideas: ContentIdea[]; generator: "claude" | "template" };
      if (res.ok) {
        setGeneratorUsed(data.generator);
        await fetchIdeas();
      }
    } finally {
      setGenerating(false);
    }
  };

  const counts = Object.fromEntries(
    (stats?.segments ?? []).map((s) => [s.id, s.count])
  );

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 py-6 sm:px-6 lg:px-8">
      <header>
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
          Singapore Business News &amp; Trends Tracker
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Real-time tracking across Company Incorporation, Corporate Secretary, Grant Advisory,
          Managed Legal (DPO, Risk &amp; GRC), and Accounting &amp; Tax — with AI-assisted content
          idea generation.
        </p>
      </header>

      <StatusBar
        totalArticles={stats?.totalArticles ?? 0}
        lastIngestAt={stats?.lastIngest?.finished_at ?? null}
        onRefresh={handleRefresh}
        refreshing={refreshing}
      />

      <SegmentTabs
        active={activeSegment}
        onChange={setActiveSegment}
        counts={counts}
        totalCount={stats?.totalArticles ?? 0}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.6fr_1fr]">
        <NewsFeed
          articles={articles}
          loading={loadingArticles}
          query={query}
          onQueryChange={setQuery}
          hasMore={articles.length < articlesTotal}
          loadingMore={loadingMore}
          onLoadMore={() => fetchArticles(articles.length, false)}
        />

        <div className="flex flex-col gap-4">
          <TrendPanel report={trendReport} loading={trendLoading} />
          <ContentIdeaPanel
            segment={activeSegment}
            ideas={ideas}
            onGenerate={handleGenerate}
            generating={generating}
            generatorUsed={generatorUsed}
            availableSegments={SEGMENTS.map((s) => ({ id: s.id, label: s.label }))}
          />
        </div>
      </div>
    </div>
  );
}
