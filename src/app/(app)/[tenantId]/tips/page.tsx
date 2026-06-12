import { MemberTipTable, type MemberTipRow } from "@/components/admin/admin-forms";
import { FixturePicker, type FixtureGroup } from "@/components/admin/fixture-picker";
import { TipCardDownload } from "@/components/predictions/tip-card-download";
import { requireAdmin } from "@/lib/auth/membership";
import { getFixtureBoard } from "@/lib/data/fixtures";
import { getMemberNames } from "@/lib/data/members";
import { berlinDayKey, formatDayHeading, formatTime } from "@/lib/format";
import { de } from "@/messages/de";

export const metadata = { title: de.admin.enterTips };

export default async function EnterTipsPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantId: string }>;
  searchParams: Promise<{ fixture?: string }>;
}) {
  const { tenantId } = await params;
  const fixtureParam = (await searchParams).fixture || undefined;
  const membership = await requireAdmin(tenantId);
  const { supabase, userId, tenantName } = membership;
  const base = `/${tenantId}/tips`;

  const board = await getFixtureBoard(supabase, tenantId, userId);
  // Locked (already-kicked-off) fixtures stay selectable so an admin can correct
  // a mistyped tip after kickoff; only fixtures without both teams are excluded.
  const selectable = board.filter((f) => f.home && f.away);
  // Default to the next still-open fixture, falling back to the most recent past
  // one — not the very first match of the tournament.
  const defaultFixture = selectable.find((f) => !f.locked) ?? selectable.at(-1);
  const selected = selectable.find((f) => f.id === fixtureParam) ?? defaultFixture;

  const nameById = await getMemberNames(supabase, tenantId);

  const { data: preds } = selected
    ? await supabase
        .from("prediction")
        .select("user_id, home_goals, away_goals")
        .eq("tenant_id", tenantId)
        .eq("fixture_id", selected.id)
    : { data: [] };
  const predByUser = new Map((preds ?? []).map((p) => [p.user_id, p]));

  const rows: MemberTipRow[] = [...nameById.entries()]
    .map(([memberId, name]) => ({
      userId: memberId,
      name,
      home: predByUser.get(memberId)?.home_goals ?? null,
      away: predByUser.get(memberId)?.away_goals ?? null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "de"));

  // Group the (already chronological) fixtures by German calendar day for the
  // picker's optgroups. No truncation — the full schedule is selectable. A
  // finished match shows its result so past games are easy to spot for a fix.
  const groups: FixtureGroup[] = [];
  for (const f of selectable) {
    const heading = formatDayHeading(f.kickoffAt);
    const result =
      f.status === "finished" && f.regularHome != null && f.regularAway != null
        ? ` · ${f.regularHome}:${f.regularAway}`
        : "";
    const label = `${formatTime(f.kickoffAt)} · ${f.home?.shortName ?? f.home?.name ?? "?"} – ${
      f.away?.shortName ?? f.away?.name ?? "?"
    }${result}`;
    const key = berlinDayKey(f.kickoffAt);
    const last = groups.at(-1);
    if (last && last.key === key) last.options.push({ id: f.id, label });
    else groups.push({ key, heading, options: [{ id: f.id, label }] });
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">{de.admin.enterTips}</h2>

      {selectable.length === 0 ? (
        <p className="text-muted-foreground text-sm">{de.admin.tipsNoFixtures}</p>
      ) : (
        <div className="space-y-3">
          <p className="text-muted-foreground text-sm">{de.admin.tipsPickFixture}</p>
          <FixturePicker base={base} selectedId={selected?.id ?? ""} groups={groups} />
          {selected?.locked && (
            <p className="text-muted-foreground text-xs">{de.admin.tipsCorrectionNote}</p>
          )}
          {selected && (
            // key forces a remount on fixture change so the table re-seeds its
            // controlled score state from the new fixture's predictions; without
            // it the state would persist and be saved onto the next fixture.
            <MemberTipTable
              key={selected.id}
              tenantId={tenantId}
              fixtureId={selected.id}
              homeName={selected.home?.name ?? "?"}
              awayName={selected.away?.name ?? "?"}
              members={rows}
              actions={
                <TipCardDownload
                  groupName={tenantName}
                  fixture={{
                    homeName: selected.home?.name ?? "?",
                    homeCode: selected.home?.shortName ?? null,
                    awayName: selected.away?.name ?? "?",
                    awayCode: selected.away?.shortName ?? null,
                    kickoffAt: selected.kickoffAt,
                    stageName: selected.stageName,
                  }}
                  rows={rows}
                />
              }
            />
          )}
        </div>
      )}
    </div>
  );
}
