"use client";

import {
  ShareCard,
  ShareRow,
  ShareTeamColumn,
  SHARE_PALETTE as C,
} from "@/components/share/share-card";
import type { ScoreCategory } from "@/lib/scoring/engine";
import { formatDateTime } from "@/lib/format";
import { de } from "@/messages/de";

export interface MatchShareRow {
  userId: string;
  name: string;
  tip: string;
  points: number | null;
  category: ScoreCategory | null;
}

export interface MatchShareFixture {
  homeName: string;
  homeCode: string | null;
  awayName: string;
  awayCode: string | null;
  kickoffAt: string;
  stageName: string;
  resultLabel: string;
}

/** Points-badge colours per category (fixed palette, matching the in-app tones). */
function badgeColors(category: ScoreCategory): { bg: string; fg: string } {
  if (category === "exact") return { bg: C.reward, fg: C.rewardFg };
  if (category === "miss") return { bg: C.muted, fg: C.mutedFg };
  return { bg: C.primary, fg: C.primaryFg }; // goal_diff / tendency: positive
}

/**
 * Downloadable image of a finished match: the fixture + result, then every
 * member's tip and the points it scored. Built on the shared ShareCard shell.
 */
export function MatchShareCard({
  groupName,
  fixture,
  rows,
}: {
  groupName: string;
  fixture: MatchShareFixture;
  rows: MatchShareRow[];
}) {
  const slug = `${fixture.homeCode ?? "team"}-${fixture.awayCode ?? "team"}`.toLowerCase();
  return (
    <ShareCard
      groupName={groupName}
      fileSlug={slug}
      buttonLabel={de.share.matchDownload}
      headerRight={
        <>
          <div className="font-medium">{fixture.stageName}</div>
          <div>{formatDateTime(fixture.kickoffAt)}</div>
        </>
      }
    >
      {/* Fixture + result */}
      <div
        className="flex items-center gap-6 px-9 py-7"
        style={{ borderBottom: `1px solid ${C.border}` }}
      >
        <ShareTeamColumn name={fixture.homeName} code={fixture.homeCode} align="end" />
        <div className="font-heading text-3xl font-extrabold tabular-nums">
          {fixture.resultLabel}
        </div>
        <ShareTeamColumn name={fixture.awayName} code={fixture.awayCode} align="start" />
      </div>

      {/* Members + their tips and points */}
      <div className="px-9 py-5">
        <div className="flex flex-col gap-1.5">
          {rows.map((row) => {
            const colors = row.category ? badgeColors(row.category) : null;
            return (
              <ShareRow key={row.userId}>
                <span className="truncate text-lg font-medium">{row.name}</span>
                <div className="flex items-center gap-3">
                  <span
                    className="font-mono text-base font-bold tabular-nums"
                    style={{ opacity: 0.8 }}
                  >
                    {row.tip}
                  </span>
                  {row.category && colors && (
                    <span
                      className="text-sm font-bold tabular-nums"
                      style={{
                        backgroundColor: colors.bg,
                        color: colors.fg,
                        borderRadius: "9999px",
                        padding: "2px 14px",
                      }}
                    >
                      {de.categories[row.category]} · {row.points ?? 0}
                    </span>
                  )}
                </div>
              </ShareRow>
            );
          })}
        </div>
      </div>
    </ShareCard>
  );
}
