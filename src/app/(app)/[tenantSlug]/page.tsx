import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireMembership } from "@/lib/auth/membership";
import { getFixtureBoard } from "@/lib/data/fixtures";
import { formatDateTime } from "@/lib/format";
import { de } from "@/messages/de";

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const membership = await requireMembership(tenantSlug);
  const board = await getFixtureBoard(membership.supabase, membership.tenantId, membership.userId);

  if (board.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        {de.empty.noFixtures} {de.empty.tournamentStarts}
      </p>
    );
  }

  const openTips = board.filter((f) => !f.locked && f.myPrediction === null);
  const upcoming = board.filter((f) => !f.locked).slice(0, 5);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{de.nav.dashboard}</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-3">
          <p className="text-sm">
            {openTips.length === 0
              ? de.empty.noOpenTips
              : `${openTips.length} ${openTips.length === 1 ? "offener Tipp" : "offene Tipps"}`}
          </p>
          <Link href={`/${tenantSlug}/spiele`} className={buttonVariants({ size: "sm" })}>
            {de.nav.fixtures}
          </Link>
        </CardContent>
      </Card>

      <section className="space-y-2">
        <h2 className="text-muted-foreground text-sm font-medium">Nächste Spiele</h2>
        {upcoming.length === 0 ? (
          <p className="text-muted-foreground text-sm">{de.empty.tournamentStarts}</p>
        ) : (
          <ul className="divide-y rounded-md border">
            {upcoming.map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <span className="truncate">
                  {f.home?.name ?? "?"} – {f.away?.name ?? "?"}
                </span>
                <span className="text-muted-foreground shrink-0 text-xs">
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
