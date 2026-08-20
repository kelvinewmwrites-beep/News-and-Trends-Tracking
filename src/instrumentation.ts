export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.SGNEWS_DISABLE_SCHEDULER === "1") return;

  const cron = (await import("node-cron")).default;
  const { ingestAll } = await import("@/lib/ingest");

  const INTERVAL_MINUTES = Number(process.env.SGNEWS_INGEST_INTERVAL_MIN ?? 15);

  const run = async () => {
    try {
      const result = await ingestAll();
      console.log(
        `[sgnews] ingest complete: +${result.newArticles} new, ${result.updatedArticles} updated (${result.durationMs}ms)`
      );
    } catch (err) {
      console.error("[sgnews] scheduled ingest failed", err);
    }
  };

  // Kick off an initial ingest shortly after boot so the dashboard has data.
  setTimeout(run, 2000);

  cron.schedule(`*/${INTERVAL_MINUTES} * * * *`, run);

  console.log(`[sgnews] scheduler registered: ingesting every ${INTERVAL_MINUTES} minute(s)`);
}
