import Link from "next/link";
import { Crown, Flame } from "lucide-react";

import { LiveLeaderboardBanner } from "@/components/leaderboard/live-leaderboard-banner";
import { LeaderboardShareCard } from "@/components/share/leaderboard-share-card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireMembership } from "@/lib/auth/membership";
import { getFixtureBoard } from "@/lib/data/fixtures";
import { getLeaderboard, getLeaderboardForm } from "@/lib/data/leaderboard";
import { computeDuels } from "@/lib/domain/head-to-head";
import { cn } from "@/lib/utils";
import { de } from "@/messages/de";

const PODIUM_TONE = [
  "bg-reward/15 border-reward/40 text-reward", // 1
  "bg-muted border-border", // 2
  "bg-chart-3/10 border-chart-3/30", // 3
];

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

/** Recent-form dots, oldest → newest: filled for a hit, faint for a miss. */
function FormDots({ recent }: { recent: ("hit" | "miss")[] }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {recent.map((r, i) => (
        <span
          key={`${i}-${r}`}
          title={r === "hit" ? de.leaderboard.formHit : de.leaderboard.formMiss}
          className={cn(
            "size-1.5 rounded-full",
            r === "hit" ? "bg-chart-1" : "bg-muted-foreground/30",
          )}
        />
      ))}
    </span>
  );
}

export const metadata = { title: de.leaderboard.title };

export default async function LeaderboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantId: string }>;
  searchParams: Promise<{ sort?: string }>;
}) {
  const { tenantId } = await params;
  const { sort = "rank" } = await searchParams;
  const membership = await requireMembership(tenantId);

  const [rows, board, form, { data: allScores }] = await Promise.all([
    getLeaderboard(membership.tenantId),
    getFixtureBoard(membership.supabase, membership.tenantId, membership.userId),
    getLeaderboardForm(membership.tenantId),
    // All members' scores in the tenant (RLS lets a member read them); the duel
    // record is per-viewer, so it is computed here, not in the cached layer.
    membership.supabase
      .from("prediction_score")
      .select("user_id, fixture_id, points")
      .eq("tenant_id", membership.tenantId),
  ]);
  const formByUser = new Map(form.map((f) => [f.user_id, f]));

  // "Deine Duelle": the current member's head-to-head vs every other member,
  // ordered by the opponent's rank. Names/ranks come from the leaderboard rows.
  const memberById = new Map(rows.map((r) => [r.user_id, { name: r.display_name, rank: r.rank }]));
  const duels = computeDuels(
    (allScores ?? []).map((s) => ({
      fixtureId: s.fixture_id,
      userId: s.user_id,
      points: s.points,
    })),
    membership.userId,
  )
    .filter((d) => memberById.has(d.opponentId))
    .sort(
      (a, b) =>
        (memberById.get(a.opponentId)?.rank ?? 0) - (memberById.get(b.opponentId)?.rank ?? 0),
    );

  // Live = kicked off but not finished. The banner names them and drives the
  // auto-refresh so points appear once the match is scored.
  const liveMatches = board.flatMap((f) =>
    f.status === "live" && f.home && f.away
      ? [{ id: f.id, home: f.home.name, away: f.away.name }]
      : [],
  );

  if (rows.length === 0) {
    return (
      <div className="space-y-3">
        <h2 className="font-heading text-lg font-bold">{de.leaderboard.title}</h2>
        {liveMatches.length > 0 && <LiveLeaderboardBanner matches={liveMatches} />}
        <p className="text-muted-foreground text-sm">{de.leaderboard.empty}</p>
      </div>
    );
  }

  const sorted = [...rows];
  if (sort === "exact") sorted.sort((a, b) => b.exact_count - a.exact_count);
  else if (sort === "hits") sorted.sort((a, b) => b.hit_count - a.hit_count);

  const podium = rows.slice(0, 3);
  const base = `/${tenantId}/leaderboard`;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-heading text-lg font-bold">{de.leaderboard.title}</h2>
        <LeaderboardShareCard
          groupName={membership.tenantName}
          rows={rows.map((r) => ({
            userId: r.user_id,
            rank: r.rank,
            name: r.display_name,
            points: r.total_points,
            exact: r.exact_count,
            hits: r.hit_count,
          }))}
        />
      </div>

      {liveMatches.length > 0 && <LiveLeaderboardBanner matches={liveMatches} />}

      {/* Podium */}
      <div className="grid grid-cols-3 gap-2">
        {podium.map((r, i) => (
          <div
            key={r.user_id}
            className={cn(
              "flex flex-col items-center gap-1 rounded-xl border p-3 text-center",
              PODIUM_TONE[i],
              i === 0 && "scale-[1.03]",
            )}
          >
            <div className="bg-background/60 relative flex size-9 items-center justify-center rounded-full text-sm font-bold">
              {initials(r.display_name)}
              {i === 0 && <Crown className="text-reward absolute -top-3 size-4" aria-hidden />}
            </div>
            <span className="w-full truncate text-xs font-medium">{r.display_name}</span>
            <span className="font-heading text-lg font-bold tabular-nums">{r.total_points}</span>
            <span className="text-muted-foreground text-[0.7rem]">
              {de.leaderboard.rank} {r.rank}
            </span>
          </div>
        ))}
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">{de.leaderboard.rank}</TableHead>
            <TableHead>{de.leaderboard.member}</TableHead>
            <TableHead className="text-right">
              <Link href={`${base}?sort=exact`} className="hover:text-foreground">
                {de.leaderboard.exact}
              </Link>
            </TableHead>
            <TableHead className="text-right">
              <Link href={`${base}?sort=hits`} className="hover:text-foreground">
                {de.leaderboard.hits}
              </Link>
            </TableHead>
            <TableHead className="text-right">
              <Link href={base} className="hover:text-foreground">
                {de.leaderboard.points}
              </Link>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((r) => {
            const isMe = r.user_id === membership.userId;
            const memberForm = formByUser.get(r.user_id);
            return (
              <TableRow
                key={r.user_id}
                className={cn(isMe && "bg-primary/10 ring-primary/30 font-medium ring-1")}
              >
                <TableCell className="tabular-nums">{r.rank}</TableCell>
                <TableCell>
                  <div className="flex flex-col gap-0.5">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate">{r.display_name}</span>
                      {isMe && <span className="text-primary text-xs">({de.leaderboard.you})</span>}
                      {memberForm && memberForm.streak >= 2 && (
                        <span
                          className="text-reward inline-flex shrink-0 items-center gap-0.5 text-xs font-semibold"
                          title={de.leaderboard.streakTitle(memberForm.streak)}
                        >
                          <Flame className="size-3" aria-hidden />
                          {memberForm.streak}
                        </span>
                      )}
                    </span>
                    {memberForm && memberForm.recent.length > 0 && (
                      <FormDots recent={memberForm.recent} />
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right tabular-nums">{r.exact_count}</TableCell>
                <TableCell className="text-right tabular-nums">{r.hit_count}</TableCell>
                <TableCell className="text-right font-semibold tabular-nums">
                  {r.total_points}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <p className="text-muted-foreground text-xs">{de.leaderboard.tieBreakNote}</p>

      {duels.length > 0 && (
        <section className="space-y-2">
          <div>
            <h3 className="font-heading text-sm font-bold">{de.leaderboard.duelsTitle}</h3>
            <p className="text-muted-foreground text-xs">{de.leaderboard.duelsHint}</p>
          </div>
          <ul className="divide-y rounded-md border">
            {duels.map((d) => {
              const ahead = d.wins > d.losses;
              const behind = d.wins < d.losses;
              return (
                <li
                  key={d.opponentId}
                  className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                  title={de.leaderboard.duelTitle(d.wins, d.losses, d.draws)}
                >
                  <span className="truncate">{memberById.get(d.opponentId)?.name ?? "—"}</span>
                  <span className="flex shrink-0 items-center gap-1.5 tabular-nums">
                    <span className={cn("font-semibold", ahead && "text-primary")}>{d.wins}</span>
                    <span className="text-muted-foreground">:</span>
                    <span className={cn("font-semibold", behind && "text-destructive")}>
                      {d.losses}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
