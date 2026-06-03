"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Refreshes the route on an interval while a match is live, so the in-match
 * projection follows the score without a manual reload. Polls ONLY while the
 * tab is visible (per the project's no-Realtime polling design) and only mounts
 * while the server still renders a live fixture, so it self-terminates at full
 * time.
 */
export function LiveRefresher({ intervalMs = 45_000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);

  return null;
}
