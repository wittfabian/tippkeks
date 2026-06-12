"use client";

import { useIntervalRefresh } from "@/lib/hooks/use-interval-refresh";

/**
 * Refreshes the route on an interval while a match is live, so the in-match
 * projection follows the score without a manual reload. Only mounts while the
 * server still renders a live fixture, so it self-terminates at full time.
 */
export function LiveRefresher({ intervalMs = 45_000 }: { intervalMs?: number }) {
  useIntervalRefresh(intervalMs);
  return null;
}
