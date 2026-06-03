"use client";

import { ShareCard, SHARE_PALETTE as C } from "@/components/share/share-card";
import { de } from "@/messages/de";

export interface LeaderboardShareRow {
  userId: string;
  rank: number;
  name: string;
  points: number;
  exact: number;
  hits: number;
}

/** Rank-badge colours: gold / silver / bronze for the podium, muted otherwise. */
function rankColors(rank: number): { bg: string; fg: string } {
  if (rank === 1) return { bg: C.reward, fg: C.rewardFg };
  if (rank === 2) return { bg: "oklch(0.85 0.01 160)", fg: C.fg };
  if (rank === 3) return { bg: "oklch(0.78 0.07 60)", fg: C.rewardFg };
  return { bg: C.muted, fg: C.mutedFg };
}

/**
 * Downloadable image of a group's standings: rank, name, points (+ exact/hits),
 * with a podium-coloured rank badge. Built on the shared ShareCard shell.
 */
export function LeaderboardShareCard({
  groupName,
  rows,
}: {
  groupName: string;
  rows: LeaderboardShareRow[];
}) {
  return (
    <ShareCard
      groupName={groupName}
      fileSlug="rangliste"
      buttonLabel={de.share.leaderboardDownload}
      headerRight={<div className="font-medium">{de.share.leaderboardSubtitle}</div>}
    >
      <div className="px-9 py-6">
        <div className="flex flex-col gap-1.5">
          {rows.map((row) => {
            const colors = rankColors(row.rank);
            return (
              <div
                key={row.userId}
                className="flex items-center justify-between gap-4 rounded-xl px-4 py-2.5"
                style={{ backgroundColor: C.muted }}
              >
                <div className="flex min-w-0 items-center gap-4">
                  <span
                    className="font-heading flex size-9 shrink-0 items-center justify-center rounded-full text-base font-bold tabular-nums"
                    style={{ backgroundColor: colors.bg, color: colors.fg }}
                  >
                    {row.rank}
                  </span>
                  <span className="truncate text-lg font-medium">{row.name}</span>
                </div>
                <div className="flex shrink-0 items-baseline gap-3">
                  <span className="text-sm" style={{ color: C.mutedFg }}>
                    {de.leaderboard.exact} {row.exact} · {de.leaderboard.hits} {row.hits}
                  </span>
                  <span className="font-heading text-xl font-extrabold tabular-nums">
                    {de.share.matchPoints(row.points)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </ShareCard>
  );
}
