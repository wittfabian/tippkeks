import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

import { LockCountdown } from "@/components/match/lock-countdown";
import { TeamIdentity } from "@/components/match/team-identity";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireMembership } from "@/lib/auth/membership";
import { getFixtureBoard } from "@/lib/data/fixtures";
import { berlinDayKey, formatDateTime } from "@/lib/format";
import { de } from "@/messages/de";

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const membership = await requireMembership(tenantId);
  const board = await getFixtureBoard(membership.supabase, membership.tenantId, membership.userId);

  if (board.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        {de.empty.noFixtures} {de.empty.tournamentStarts}
      </p>
    );
  }

  const openUntipped = board.filter((f) => !f.locked && f.myPrediction === null);
  const nextDue = openUntipped[0];
  // Count tips that actually close on the current Berlin day — not on the
  // next-due fixture's day (which would read "closes today" even weeks ahead).
  const todayKey = berlinDayKey(new Date());
  const closesToday = openUntipped.filter((f) => berlinDayKey(f.kickoffAt) === todayKey).length;
  const upcoming = board.filter((f) => !f.locked).slice(0, 5);

  return (
    <div className="space-y-4">
      {nextDue ? (
        <Card className="border-primary/30 from-primary/5 bg-gradient-to-br to-transparent">
          <CardContent className="space-y-3 py-4">
            <div className="flex items-center justify-between">
              <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                {de.dashboard.nextDue}
              </p>
              <span className="text-primary font-heading text-sm font-bold tabular-nums">
                <LockCountdown target={nextDue.kickoffAt} />
              </span>
            </div>
            <div className="flex items-center gap-2">
              <TeamIdentity team={nextDue.home} className="flex-1" />
              <span className="text-muted-foreground font-heading shrink-0 text-sm">:</span>
              <TeamIdentity team={nextDue.away} align="end" className="flex-1" />
            </div>
            <div className="flex items-center justify-between gap-2">
              <p className="text-muted-foreground text-xs">
                {closesToday > 0 ? de.dashboard.closesToday(closesToday) : ""}
              </p>
              <Link href={`/${tenantId}/spiele`} className={buttonVariants({ size: "sm" })}>
                {de.dashboard.tipNow}
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-primary/30">
          <CardContent className="text-primary flex items-center gap-2 py-4 text-sm font-medium">
            <CheckCircle2 className="size-5" />
            {de.dashboard.allDone}
          </CardContent>
        </Card>
      )}

      <section className="space-y-2">
        <h2 className="text-muted-foreground text-sm font-medium">{de.dashboard.upcoming}</h2>
        {upcoming.length === 0 ? (
          <p className="text-muted-foreground text-sm">{de.empty.tournamentStarts}</p>
        ) : (
          <ul className="divide-y rounded-md border">
            {upcoming.map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <span className="flex min-w-0 flex-1 items-center gap-2">
                  <TeamIdentity team={f.home} showName={false} />
                  <span className="text-muted-foreground truncate text-xs">
                    {f.home?.name ?? "?"} – {f.away?.name ?? "?"}
                  </span>
                </span>
                <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                  {formatDateTime(f.kickoffAt)} Uhr
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
