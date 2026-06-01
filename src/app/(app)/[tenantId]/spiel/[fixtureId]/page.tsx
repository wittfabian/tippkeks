import { notFound } from "next/navigation";

import { CategoryChip } from "@/components/match/category-chip";
import { TeamIdentity } from "@/components/match/team-identity";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireMembership } from "@/lib/auth/membership";
import type { ScoreCategory } from "@/lib/scoring/engine";
import { formatDateTime, hasKickedOff } from "@/lib/format";
import { cn } from "@/lib/utils";
import { de } from "@/messages/de";

export default async function FixtureDetailPage({
  params,
}: {
  params: Promise<{ tenantId: string; fixtureId: string }>;
}) {
  const { tenantId: tenantIdParam, fixtureId } = await params;
  const membership = await requireMembership(tenantIdParam);

  const { supabase, tenantId, userId } = membership;
  const id = fixtureId;

  const { data: fixture } = await supabase
    .from("fixture")
    .select(
      "id, kickoff_at, regular_home, regular_away, after_extra_time, home_team_id, away_team_id, stage:stage_id(name)",
    )
    .eq("id", id)
    .maybeSingle();
  if (!fixture) notFound();

  const teamIds = [fixture.home_team_id, fixture.away_team_id].filter(
    (x): x is string => x != null,
  );
  const { data: teams } = teamIds.length
    ? await supabase.from("team").select("id, name, short_name").in("id", teamIds)
    : { data: [] };
  const teamById = new Map(
    (teams ?? []).map((t) => [t.id, { name: t.name, shortName: t.short_name }]),
  );
  const home = fixture.home_team_id != null ? (teamById.get(fixture.home_team_id) ?? null) : null;
  const away = fixture.away_team_id != null ? (teamById.get(fixture.away_team_id) ?? null) : null;
  const kickedOff = hasKickedOff(fixture.kickoff_at);
  const hasResult = fixture.regular_home != null && fixture.regular_away != null;

  const [{ data: predictions }, { data: scores }, { count: memberCount }] = await Promise.all([
    supabase
      .from("prediction")
      .select("user_id, home_goals, away_goals")
      .eq("tenant_id", tenantId)
      .eq("fixture_id", id),
    supabase
      .from("prediction_score")
      .select("user_id, points, category")
      .eq("tenant_id", tenantId)
      .eq("fixture_id", id),
    supabase
      .from("tenant_member")
      .select("user_id", { count: "exact", head: true })
      .eq("tenant_id", tenantId),
  ]);

  const userIds = (predictions ?? []).map((p) => p.user_id);
  const { data: profiles } = userIds.length
    ? await supabase.from("profile").select("user_id, display_name").in("user_id", userIds)
    : { data: [] };
  const nameById = new Map((profiles ?? []).map((p) => [p.user_id, p.display_name]));
  const scoreByUser = new Map((scores ?? []).map((s) => [s.user_id, s]));

  // Consensus (most-common scoreline).
  const tally = new Map<string, number>();
  for (const p of predictions ?? []) {
    const key = `${p.home_goals}:${p.away_goals}`;
    tally.set(key, (tally.get(key) ?? 0) + 1);
  }
  const consensus = [...tally.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const rows = (predictions ?? [])
    .map((p) => ({
      userId: p.user_id,
      name: nameById.get(p.user_id) ?? "—",
      tip: `${p.home_goals}:${p.away_goals}`,
      points: scoreByUser.get(p.user_id)?.points ?? null,
      category: (scoreByUser.get(p.user_id)?.category ?? null) as ScoreCategory | null,
      isMe: p.user_id === userId,
    }))
    .sort((a, b) => (b.points ?? -1) - (a.points ?? -1));

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-2 py-4">
          <p className="text-muted-foreground text-center text-xs">{fixture.stage?.name}</p>
          <div className="flex items-center justify-center gap-3">
            <TeamIdentity team={home} align="end" className="flex-1" />
            <span className="font-heading shrink-0 text-2xl font-extrabold tabular-nums">
              {hasResult
                ? `${fixture.regular_home}:${fixture.regular_away}${fixture.after_extra_time ? " n.V." : ""}`
                : "–:–"}
            </span>
            <TeamIdentity team={away} className="flex-1" />
          </div>
          <p className="text-muted-foreground text-center text-xs">
            {formatDateTime(fixture.kickoff_at)} Uhr
          </p>
        </CardContent>
      </Card>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-lg font-bold">{de.predictions.allTitle}</h2>
          {kickedOff && (
            <span className="text-muted-foreground text-xs">
              {de.predictions.submittedCount(rows.length, memberCount ?? rows.length)}
              {consensus && ` · ${de.predictions.consensus} ${consensus}`}
            </span>
          )}
        </div>

        {!kickedOff ? (
          <p className="text-muted-foreground text-sm">{de.predictions.notVisibleYet}</p>
        ) : rows.length === 0 ? (
          <p className="text-muted-foreground text-sm">{de.predictions.noPredictions}</p>
        ) : (
          <Table className="motion-safe:animate-in motion-safe:fade-in">
            <TableHeader>
              <TableRow>
                <TableHead>{de.predictions.member}</TableHead>
                <TableHead>{de.predictions.tip}</TableHead>
                <TableHead className="text-right">{de.fixtures.points}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow
                  key={r.userId}
                  className={cn(r.isMe && "bg-primary/10 ring-primary/30 font-medium ring-1")}
                >
                  <TableCell className="truncate">
                    {r.name}
                    {r.isMe && (
                      <span className="text-primary ml-1 text-xs">({de.leaderboard.you})</span>
                    )}
                  </TableCell>
                  <TableCell className="tabular-nums">{r.tip}</TableCell>
                  <TableCell className="text-right">
                    {r.category ? (
                      <CategoryChip category={r.category} points={r.points} />
                    ) : (
                      <span className="tabular-nums">{r.points ?? "–"}</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </div>
  );
}
