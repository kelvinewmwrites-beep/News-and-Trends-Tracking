import { NextResponse } from "next/server";
import { countArticlesBySegment } from "@/lib/articles";
import { getLastIngest } from "@/lib/ingest";
import { SEGMENTS } from "@/lib/segments";

export const dynamic = "force-dynamic";

export async function GET() {
  const counts = countArticlesBySegment();
  const lastIngest = getLastIngest() ?? null;

  const segments = SEGMENTS.map((s) => ({
    id: s.id,
    label: s.label,
    count: counts[s.id] ?? 0,
  }));

  return NextResponse.json({
    segments,
    totalArticles: Object.values(counts).reduce((a, b) => a + b, 0),
    lastIngest,
  });
}
