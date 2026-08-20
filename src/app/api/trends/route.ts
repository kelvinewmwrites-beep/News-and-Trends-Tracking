import { NextRequest, NextResponse } from "next/server";
import { computeTrends } from "@/lib/trends";
import { SEGMENTS, isSegmentId } from "@/lib/segments";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const segmentParam = params.get("segment") ?? "all";
  const days = Math.min(Math.max(Number(params.get("days") ?? 14), 1), 60);

  if (segmentParam === "all") {
    const reports = SEGMENTS.map((s) => computeTrends(s.id, days));
    return NextResponse.json({ reports });
  }

  if (!isSegmentId(segmentParam)) {
    return NextResponse.json({ error: "Unknown segment" }, { status: 400 });
  }

  const report = computeTrends(segmentParam, days);
  return NextResponse.json({ reports: [report] });
}
