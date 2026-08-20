import { NextRequest, NextResponse } from "next/server";
import { generateContentIdeas, listContentIdeas } from "@/lib/contentIdeas";
import { isSegmentId } from "@/lib/segments";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const segmentParam = params.get("segment");
  const limit = Math.min(Math.max(Number(params.get("limit") ?? 50), 1), 200);

  if (segmentParam && !isSegmentId(segmentParam)) {
    return NextResponse.json({ error: "Unknown segment" }, { status: 400 });
  }

  const ideas = listContentIdeas(
    segmentParam && isSegmentId(segmentParam) ? segmentParam : undefined,
    limit
  );
  return NextResponse.json({ ideas });
}

export async function POST(req: NextRequest) {
  let body: { segment?: string; count?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.segment || !isSegmentId(body.segment)) {
    return NextResponse.json({ error: "A valid `segment` is required" }, { status: 400 });
  }

  const count = Math.min(Math.max(Number(body.count ?? 5), 1), 10);

  try {
    const { ideas, generator } = await generateContentIdeas(body.segment, count);
    return NextResponse.json({ ideas, generator });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
