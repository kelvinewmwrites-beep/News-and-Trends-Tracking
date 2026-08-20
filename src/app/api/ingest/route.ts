import { NextResponse } from "next/server";
import { ingestAll, getLastIngest } from "@/lib/ingest";

export const dynamic = "force-dynamic";

const MIN_INTERVAL_MS = 60_000;

declare global {
  var __lastManualIngestAt: number | undefined;
  var __ingestInFlight: Promise<unknown> | undefined;
}

export async function POST() {
  const now = Date.now();
  const last = globalThis.__lastManualIngestAt ?? 0;

  if (globalThis.__ingestInFlight) {
    await globalThis.__ingestInFlight;
    return NextResponse.json({ ok: true, deduped: true, lastIngest: getLastIngest() });
  }

  if (now - last < MIN_INTERVAL_MS) {
    return NextResponse.json(
      {
        ok: false,
        error: "Rate limited",
        retryInMs: MIN_INTERVAL_MS - (now - last),
      },
      { status: 429 }
    );
  }

  globalThis.__lastManualIngestAt = now;
  const task = ingestAll();
  globalThis.__ingestInFlight = task;
  try {
    const result = await task;
    return NextResponse.json({ ok: true, result });
  } finally {
    globalThis.__ingestInFlight = undefined;
  }
}

export async function GET() {
  return NextResponse.json({ lastIngest: getLastIngest() ?? null });
}
