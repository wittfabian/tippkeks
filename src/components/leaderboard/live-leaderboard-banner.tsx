"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { de } from "@/messages/de";

export interface LiveMatch {
  id: string;
  home: string;
  away: string;
}

/**
 * Banner shown on the leaderboard while one or more matches are live. It also
 * refreshes the route on an interval so that, once the sync scores a finished
 * match and invalidates the leaderboard cache, the new standings appear without
 * a manual reload. The component only mounts while matches are live, so the
 * interval self-terminates once the server stops rendering it.
 */
export function LiveLeaderboardBanner({
  matches,
  intervalMs = 60_000,
}: {
  matches: LiveMatch[];
  intervalMs?: number;
}) {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);

  return (
    <div className="border-live/30 bg-live/10 rounded-xl border px-4 py-3" role="status">
      <div className="flex items-center gap-2">
        <span className="bg-live size-2 rounded-full motion-safe:animate-pulse" aria-hidden />
        <span className="text-sm font-semibold">{de.leaderboard.liveHeading(matches.length)}</span>
      </div>
      <ul className="text-muted-foreground mt-1.5 space-y-0.5 text-sm">
        {matches.map((m) => (
          <li key={m.id}>
            {m.home} – {m.away}
          </li>
        ))}
      </ul>
      <p className="text-muted-foreground mt-1.5 text-xs">{de.leaderboard.liveHint}</p>
    </div>
  );
}
