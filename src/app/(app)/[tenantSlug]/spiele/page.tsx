import Link from "next/link";

import { FilterBar } from "@/components/match/filter-bar";
import { MatchCard } from "@/components/match/match-card";
import { CelebrateExactHits } from "@/components/predictions/celebrate-exact-hits";
import { requireMembership } from "@/lib/auth/membership";
import { getFixtureBoard, type FixtureVM } from "@/lib/data/fixtures";
import { STAGE_META } from "@/lib/domain/stages";
import { berlinDayKey, formatDayHeading } from "@/lib/format";
import { de } from "@/messages/de";

export const metadata = { title: de.fixtures.title };

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
  searchParams,
}: {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<{ status?: string; stage?: string; team?: string }>;
}) {
  const { tenantSlug } = await params;
  const { status = "open", stage = "all", team = "all" } = await searchParams;
  const membership = await requireMembership(tenantSlug);
  const board = await getFixtureBoard(membership.supabase, membership.tenantId, membership.userId);
  const canTip = membership.role === "admin" || membership.memberTippingEnabled;

  // Filter options derived from the full board.
  const stageKinds = [...new Set(board.map((f) => f.stageKind))].sort(
    (a, b) => STAGE_META[a].ordinal - STAGE_META[b].ordinal,
  );
  const stages = stageKinds.map((kind) => ({ kind, name: STAGE_META[kind].name }));
  const nationsMap = new Map<string, string>();
  for (const f of board) {
    for (const t of [f.home, f.away]) {
      if (t?.shortName) nationsMap.set(t.shortName, t.name);
    }
  }
  const nations = [...nationsMap.entries()]
    .map(([code, name]) => ({ code, name }))
    .sort((a, b) => a.name.localeCompare(b.name, "de"));
  const openCount = board.filter((f) => !f.locked && f.myPrediction === null).length;
  const exactHits = board
    .filter((f) => f.myCategory === "exact")
    .map((f) => ({
      id: f.id,
      points: f.myPoints ?? 0,
      label: `${f.home?.name ?? "?"} ${f.regularHome ?? ""}:${f.regularAway ?? ""} ${f.away?.name ?? "?"}`,
    }));

  // Apply the active filters.
  const filtered = board.filter((f) => {
    if (status === "open" && f.locked) return false;
    if (status === "live" && f.status !== "live") return false;
    if (status === "finished" && f.status !== "finished") return false;
    if (stage !== "all" && f.stageKind !== stage) return false;
    if (team !== "all" && f.home?.shortName !== team && f.away?.shortName !== team) return false;
    return true;
  });
  const groups = groupByDay(filtered);

  return (
    <div className="space-y-4">
      <CelebrateExactHits hits={exactHits} />
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-lg font-bold">{de.fixtures.title}</h2>
        <p className="text-muted-foreground text-xs">{de.fixtures.delayedNote}</p>
      </div>

      {!canTip && (
        <p className="border-border text-muted-foreground rounded-md border border-dashed px-3 py-2 text-xs">
          {de.fixtures.tippingDisabled}
        </p>
      )}

      <FilterBar stages={stages} nations={nations} openCount={openCount} />

      {groups.length === 0 ? (
        <div className="text-muted-foreground space-y-3 py-8 text-center text-sm">
          <p>
            {board.length === 0
              ? `${de.empty.noFixtures} ${de.empty.tournamentStarts}`
              : de.filters.noResults}
          </p>
          {board.length > 0 && (
            <Link href={`/${tenantSlug}/spiele`} className="text-primary underline">
              {de.filters.reset}
            </Link>
          )}
        </div>
      ) : (
        groups.map((group) => (
          <section key={group.key} className="space-y-2">
            <h3 className="text-muted-foreground text-sm font-medium">{group.heading}</h3>
            <ul className="space-y-2">
              {group.items.map((f) => (
                <li key={f.id}>
                  <MatchCard
                    fixture={f}
                    tenantId={membership.tenantId}
                    slug={tenantSlug}
                    canTip={canTip}
                  />
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
