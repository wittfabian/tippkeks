import Link from "next/link";

import { PredictionForm } from "@/components/predictions/prediction-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { requireMembership } from "@/lib/auth/membership";
import { getFixtureBoard, type FixtureVM } from "@/lib/data/fixtures";
import { isKnockoutStage } from "@/lib/domain/stages";
import { berlinDayKey, formatDayHeading, formatTime } from "@/lib/format";
import { de } from "@/messages/de";

export const metadata = { title: de.fixtures.title };

function teamName(name: string | null | undefined): string {
  return name ?? "?";
}

function resultLabel(f: FixtureVM): string {
  if (f.regularHome == null || f.regularAway == null) return "–";
  const suffix = f.afterExtraTime ? " n.V." : "";
  const pens =
    f.penaltyHome != null && f.penaltyAway != null
      ? ` (${f.penaltyHome}:${f.penaltyAway} i.E.)`
      : "";
  return `${f.regularHome}:${f.regularAway}${suffix}${pens}`;
}

function groupByDay(fixtures: FixtureVM[]) {
  const groups: { key: string; heading: string; items: FixtureVM[] }[] = [];
  for (const fixture of fixtures) {
    const key = berlinDayKey(fixture.kickoffAt);
    let group = groups.at(-1);
    if (!group || group.key !== key) {
      group = { key, heading: formatDayHeading(fixture.kickoffAt), items: [] };
      groups.push(group);
    }
    group.items.push(fixture);
  }
  return groups;
}

export default async function FixturesPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const membership = await requireMembership(tenantSlug);
  const board = await getFixtureBoard(membership.supabase, membership.tenantId, membership.userId);
  const groups = groupByDay(board);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{de.fixtures.title}</h2>
        <p className="text-muted-foreground text-xs">{de.fixtures.delayedNote}</p>
      </div>

      {groups.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          {de.empty.noFixtures} {de.empty.tournamentStarts}
        </p>
      ) : (
        groups.map((group) => (
          <section key={group.key} className="space-y-2">
            <h3 className="text-muted-foreground text-sm font-medium">{group.heading}</h3>
            <ul className="space-y-2">
              {group.items.map((f) => (
                <li key={f.id}>
                  <Card>
                    <CardContent className="space-y-2 py-3">
                      <div className="text-muted-foreground flex items-center justify-between text-xs">
                        <span>
                          {f.stageName}
                          {f.matchday ? ` · Spieltag ${f.matchday}` : ""}
                        </span>
                        <span>
                          {de.fixtures.kickoffLabel} {formatTime(f.kickoffAt)} Uhr
                        </span>
                      </div>

                      {f.locked ? (
                        <div className="space-y-1">
                          <div className="flex items-center justify-center gap-3 text-sm">
                            <span className="flex-1 truncate text-right">
                              {teamName(f.home?.name)}
                            </span>
                            <span className="font-semibold tabular-nums">{resultLabel(f)}</span>
                            <span className="flex-1 truncate">{teamName(f.away?.name)}</span>
                          </div>
                          <div className="text-muted-foreground flex items-center justify-between text-xs">
                            <span>
                              {de.fixtures.yourTip}:{" "}
                              {f.myPrediction
                                ? `${f.myPrediction.homeGoals}:${f.myPrediction.awayGoals}`
                                : "–"}
                              {f.myPoints != null && (
                                <Badge variant="secondary" className="ml-2">
                                  {f.myPoints} {de.fixtures.points}
                                </Badge>
                              )}
                            </span>
                            <Link
                              href={`/${tenantSlug}/spiel/${f.id}`}
                              className="hover:text-foreground underline"
                            >
                              {de.fixtures.viewAll}
                            </Link>
                          </div>
                        </div>
                      ) : (
                        <PredictionForm
                          tenantId={membership.tenantId}
                          slug={tenantSlug}
                          fixtureId={f.id}
                          homeName={teamName(f.home?.name)}
                          awayName={teamName(f.away?.name)}
                          knockout={isKnockoutStage(f.stageKind)}
                          homeTeamId={f.home?.id ?? null}
                          awayTeamId={f.away?.id ?? null}
                          initial={f.myPrediction}
                        />
                      )}
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
