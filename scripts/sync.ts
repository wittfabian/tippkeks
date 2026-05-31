/**
 * Standalone fixture/result sync entrypoint. Intended to be invoked by an
 * OS/container timer (systemd timer or a cron sidecar) on the self-hosted host,
 * e.g. every minute during live match windows and once daily for a full sync.
 *
 * Run: pnpm sync
 */
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  // Import after env is loaded so server env validation sees the values.
  const { footballDataProvider } = await import("../src/lib/providers/footballData");
  const { runSync } = await import("../src/lib/sync/run");

  const report = await runSync(footballDataProvider());
  console.log(
    `[sync] provider=${report.provider} teams=${report.teams} fixtures=${report.fixtures} scored=${report.scoredFixtures}`,
  );
}

main().catch((error) => {
  console.error("[sync] failed:", error);
  process.exitCode = 1;
});
