import Link from "next/link";

import { CategoryChip } from "@/components/match/category-chip";
import { LockCountdown } from "@/components/match/lock-countdown";
import { TeamIdentity } from "@/components/match/team-identity";
import { PredictionForm } from "@/components/predictions/prediction-form";
import { Card, CardContent } from "@/components/ui/card";
import { isKnockoutStage } from "@/lib/domain/stages";
import type { FixtureVM } from "@/lib/data/fixtures";
import { formatKickoffTime, formatResult, formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { de } from "@/messages/de";

// Coloured left edge: category colour once graded, ice-blue while live.
function edgeClass(f: FixtureVM): string {
  if (f.status === "live") return "border-l-4 border-l-live";
  if (f.myCategory === "exact") return "border-l-4 border-l-chart-1";
  if (f.myCategory === "goal_diff") return "border-l-4 border-l-chart-2";
  if (f.myCategory === "tendency") return "border-l-4 border-l-chart-3";
  if (f.status === "finished") return "border-l-4 border-l-border";
  return "";
}

export function MatchCard({
  fixture: f,
  tenantId,
  canTip,
  pulse,
}: {
  fixture: FixtureVM;
  tenantId: string;
  /** Whether the current user may submit a tip (members in view-only mode can't). */
  canTip: boolean;
  /** Pre-kickoff group tip count (aggregate only — never reveals tip content). */
  pulse?: { tipped: number; members: number };
}) {
  const hasResult = f.regularHome != null && f.regularAway != null;
  const isLive = f.status === "live";

  return (
    <Card className={cn("overflow-hidden", edgeClass(f))}>
      <CardContent className="space-y-2 py-3">
        {/* Band 1: stage + matchday · status/time */}
        <div className="text-muted-foreground flex items-center justify-between gap-2 text-xs">
          <span className="truncate">
            {f.stageName}
            {f.matchday ? ` · ST ${f.matchday}` : ""}
          </span>
          {isLive ? (
            <span className="text-live inline-flex items-center gap-1 font-semibold">
              <span
                className="bg-destructive size-1.5 rounded-full motion-safe:animate-pulse"
                aria-hidden
              />
              {de.status.live}
            </span>
          ) : f.status === "finished" ? (
            <span>{de.status.finished}</span>
          ) : f.locked ? (
            <span>{formatKickoffTime(f.kickoffAt)}</span>
          ) : (
            <span className="inline-flex items-center gap-2">
              {pulse && pulse.members > 0 && (
                <span
                  className="inline-flex items-center gap-1"
                  title={de.predictions.pulseTitle(pulse.tipped, pulse.members)}
                >
                  <span className="bg-primary/70 size-1.5 rounded-full" aria-hidden />
                  {de.predictions.pulse(pulse.tipped, pulse.members)}
                </span>
              )}
              <span>{formatKickoffTime(f.kickoffAt)}</span>
            </span>
          )}
        </div>

        {/* Band 2: matchup + score/kickoff */}
        <div className="flex items-center gap-2">
          <TeamIdentity team={f.home} className="flex-1" />
          <span className="font-heading shrink-0 px-1 text-center text-lg font-bold tabular-nums">
            {hasResult || isLive ? formatResult(f) : formatTime(f.kickoffAt)}
          </span>
          <TeamIdentity team={f.away} align="end" className="flex-1" />
        </div>

        {/* Band 3: action (open) or your-tip summary (locked) */}
        {f.locked ? (
          <div className="text-muted-foreground flex items-center justify-between gap-2 text-xs">
            <span className="flex items-center gap-2">
              <span>
                {de.fixtures.yourTip}:{" "}
                <span className="text-foreground tabular-nums">
                  {f.myPrediction ? `${f.myPrediction.homeGoals}:${f.myPrediction.awayGoals}` : "–"}
                </span>
              </span>
              {f.myCategory && <CategoryChip category={f.myCategory} points={f.myPoints} />}
            </span>
            <Link href={`/${tenantId}/match/${f.id}`} className="hover:text-foreground underline">
              {de.fixtures.viewAll}
            </Link>
          </div>
        ) : canTip ? (
          <>
            <div className="text-muted-foreground flex items-center justify-center gap-1 text-xs">
              <span>{de.fixtures.closesIn}</span>
              <LockCountdown target={f.kickoffAt} className="text-foreground tabular-nums" />
            </div>
            <PredictionForm
              tenantId={tenantId}
              fixtureId={f.id}
              homeName={f.home?.name ?? "?"}
              awayName={f.away?.name ?? "?"}
              homeCode={f.home?.shortName ?? null}
              awayCode={f.away?.shortName ?? null}
              knockout={isKnockoutStage(f.stageKind)}
              homeTeamId={f.home?.id ?? null}
              awayTeamId={f.away?.id ?? null}
              initial={f.myPrediction}
            />
          </>
        ) : (
          // View-only mode: members can't tip, but see any admin-entered tip.
          <div className="text-muted-foreground flex items-center justify-between gap-2 text-xs">
            <span>
              {de.fixtures.yourTip}:{" "}
              <span className="text-foreground tabular-nums">
                {f.myPrediction ? `${f.myPrediction.homeGoals}:${f.myPrediction.awayGoals}` : "–"}
              </span>
            </span>
            <span>{de.fixtures.tippingDisabledShort}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
