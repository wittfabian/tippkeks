"use client";

import {
  ShareCard,
  ShareRow,
  ShareTeamColumn,
  SHARE_PALETTE as C,
} from "@/components/share/share-card";
import { formatDateTime } from "@/lib/format";
import { de } from "@/messages/de";

export interface TipCardFixture {
  homeName: string;
  homeCode: string | null;
  awayName: string;
  awayCode: string | null;
  kickoffAt: string;
  stageName: string;
}

export interface TipCardRow {
  userId: string;
  name: string;
  home: number | null;
  away: number | null;
}

/**
 * Downloadable image of every member's saved tip for one fixture, built on the
 * shared ShareCard shell (brand chrome + palette + capture/download). Only the
 * fixture header and the per-member tip rows are specific to this card.
 */
export function TipCardDownload({
  groupName,
  fixture,
  rows,
}: {
  groupName: string;
  fixture: TipCardFixture;
  rows: TipCardRow[];
}) {
  const slug = `${fixture.homeCode ?? "team"}-${fixture.awayCode ?? "team"}`.toLowerCase();
  return (
    <ShareCard
      groupName={groupName}
      fileSlug={slug}
      buttonLabel={de.admin.tipImageDownload}
      buttonTitle={de.admin.tipImageHint}
      headerRight={
        <>
          <div className="font-medium">{fixture.stageName}</div>
          <div>{formatDateTime(fixture.kickoffAt)}</div>
        </>
      }
    >
      {/* Fixture */}
      <div
        className="flex items-center gap-6 px-9 py-7"
        style={{ borderBottom: `1px solid ${C.border}` }}
      >
        <ShareTeamColumn name={fixture.homeName} code={fixture.homeCode} align="end" />
        <div className="font-heading text-xl font-bold" style={{ color: C.mutedFg, opacity: 0.7 }}>
          :
        </div>
        <ShareTeamColumn name={fixture.awayName} code={fixture.awayCode} align="start" />
      </div>

      {/* Members + their tips */}
      <div className="px-9 py-5">
        <div className="flex flex-col gap-1.5">
          {rows.map((row) => {
            const hasTip = row.home !== null && row.away !== null;
            return (
              <ShareRow key={row.userId}>
                <span className="truncate text-lg font-medium">{row.name}</span>
                {hasTip ? (
                  <span
                    className="font-mono text-lg font-bold tabular-nums"
                    style={{
                      backgroundColor: C.reward,
                      color: C.rewardFg,
                      borderRadius: "9999px",
                      padding: "2px 16px",
                      letterSpacing: "0.05em",
                    }}
                  >
                    {row.home} : {row.away}
                  </span>
                ) : (
                  <span className="text-sm" style={{ color: C.mutedFg }}>
                    {de.admin.tipImageNoTip}
                  </span>
                )}
              </ShareRow>
            );
          })}
        </div>
      </div>
    </ShareCard>
  );
}
