import { NextRequest, NextResponse } from "next/server";
import { listArticles } from "@/lib/articles";
import { isSegmentId, type SegmentId } from "@/lib/segments";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const segmentParam = params.get("segment") ?? "all";
  const segment: SegmentId | "all" = isSegmentId(segmentParam) ? segmentParam : "all";
  const days = Math.min(Math.max(Number(params.get("days") ?? 30), 1), 90);
  const q = params.get("q") ?? undefined;
  const limit = Math.min(Math.max(Number(params.get("limit") ?? 30), 1), 100);
  const offset = Math.max(Number(params.get("offset") ?? 0), 0);

  const result = listArticles({ segment, days, q, limit, offset });

  return NextResponse.json(result);
}
