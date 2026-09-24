import fs from "node:fs";
import path from "node:path";
import { listArticles } from "../src/lib/articles";
import { ingestAll } from "../src/lib/ingest";
import { SEGMENTS, WATCHED_SITES, matchSegments } from "../src/lib/segments";
import { computeTrends, type TrendKeyword } from "../src/lib/trends";
import type { Article } from "../src/lib/types";

const WINDOW_DAYS = 7;
const NEWS_PER_SEGMENT = 8;
const GUIDES_PER_SEGMENT = 5;
const TRENDS_PER_SEGMENT = 8;
const REPORTS_DIR = path.join(process.cwd(), "reports");

const sgDate = (d: Date | string, opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-SG", { timeZone: "Asia/Singapore", ...opts }).format(new Date(d));

const md = (text: string) => text.replace(/([[\]|*_`])/g, "\\$1");

// Drop single words already covered by a phrase with the same count ("decision" vs "decision tree").
function dedupeTerms(keywords: TrendKeyword[]): TrendKeyword[] {
  return keywords.filter(
    (k) =>
      k.term.includes(" ") ||
      !keywords.some((p) => p.term.includes(" ") && p.count === k.count && p.term.split(" ").includes(k.term))
  );
}

function formatTrends(keywords: TrendKeyword[]): string {
  const terms = dedupeTerms(keywords).slice(0, TRENDS_PER_SEGMENT);
  if (terms.length === 0) return "_Not enough coverage this week._";
  return terms.map((k) => `**${md(k.term)}** (${k.count}${k.rising ? " ↑" : ""})`).join(" · ");
}

function formatArticle(a: Article): string {
  const date = a.publishedAt ? sgDate(a.publishedAt, { day: "numeric", month: "short" }) : "undated";
  return `- [${md(a.title)}](${a.link}) — ${md(a.source ?? "Unknown")}, ${date}`;
}

function buildReport(now: Date): string {
  const watchedSources = new Set(WATCHED_SITES.map((s) => s.source));
  const from = new Date(now.getTime() - WINDOW_DAYS * 86400_000);
  const range = `${sgDate(from, { day: "numeric", month: "short" })} – ${sgDate(now, { day: "numeric", month: "short", year: "numeric" })}`;

  const sections = SEGMENTS.map((segment) => {
    const trends = computeTrends(segment.id, WINDOW_DAYS);
    const seenTitles = new Set<string>();
    const articles = listArticles({ segment: segment.id, days: WINDOW_DAYS, limit: 100 }).articles.filter(
      (a) => !seenTitles.has(a.title) && seenTitles.add(a.title)
    );
    const isOnTopic = (a: Article) => matchSegments(a.title).includes(segment.id);
    const otherNews = articles.filter((a) => !watchedSources.has(a.source ?? ""));
    const news = [...otherNews.filter(isOnTopic), ...otherNews.filter((a) => !isOnTopic(a))].slice(
      0,
      NEWS_PER_SEGMENT
    );
    const guides = articles.filter((a) => watchedSources.has(a.source ?? "")).slice(0, GUIDES_PER_SEGMENT);
    const topSources = trends.topSources
      .filter((s) => !watchedSources.has(s.source))
      .slice(0, 4)
      .map((s) => `${md(s.source)} (${s.count})`)
      .join(", ");

    const summaryRow = `| ${segment.label} | ${trends.articleCount} | ${formatTrends(trends.keywords.slice(0, 6)).replace(/ · /g, ", ")} |`;

    const body = [
      `## ${segment.label}`,
      "",
      `**Trending:** ${formatTrends(trends.keywords)}`,
      "",
      `**Most active sources:** ${topSources || "_none_"}`,
      "",
      "### Latest news",
      news.length ? news.map(formatArticle).join("\n") : "_No news articles this week._",
    ];
    if (guides.length) {
      body.push("", "### Practitioner guides", guides.map(formatArticle).join("\n"));
    }
    return { summaryRow, body: body.join("\n") };
  });

  return [
    "# Singapore Business News & Trends — Weekly Report",
    "",
    `_${range} · generated ${sgDate(now, { dateStyle: "medium", timeStyle: "short" })} SGT · ${WINDOW_DAYS}-day window_`,
    "",
    "Trend counts are the number of articles mentioning a term this week; ↑ means it is rising (more mentions in the second half of the week).",
    "Practitioner guides come from watched sites: " + WATCHED_SITES.map((s) => s.source).join(", ") + ".",
    "",
    "| Segment | Articles | Top trends |",
    "| --- | --- | --- |",
    ...sections.map((s) => s.summaryRow),
    "",
    ...sections.map((s) => s.body + "\n"),
    "---",
    "Past weekly reports are kept in `reports/archive/`.",
    "",
  ].join("\n");
}

async function main() {
  const result = await ingestAll();
  console.log(`Ingested: +${result.newArticles} new, ${result.updatedArticles} updated (${result.durationMs}ms)`);
  if (result.newArticles + result.updatedArticles === 0) {
    throw new Error("No articles ingested; refusing to write an empty report.");
  }

  const now = new Date();
  const report = buildReport(now);
  const isoDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Singapore" }).format(now);
  const archiveDir = path.join(REPORTS_DIR, "archive");
  fs.mkdirSync(archiveDir, { recursive: true });
  fs.writeFileSync(path.join(REPORTS_DIR, "weekly-trends.md"), report);
  fs.writeFileSync(path.join(archiveDir, `${isoDate}.md`), report);
  console.log(`Wrote reports/weekly-trends.md and reports/archive/${isoDate}.md`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
