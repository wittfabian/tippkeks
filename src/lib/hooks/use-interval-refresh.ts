"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Refresh the current route on an interval, but ONLY while the tab is visible
 * (the project's no-Realtime polling design — don't poll a backgrounded tab).
 * Used by the live-match and live-leaderboard refreshers; both only mount while
 * the server still renders a live state, so the interval self-terminates.
 */
export function useIntervalRefresh(intervalMs: number): void {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);
}
