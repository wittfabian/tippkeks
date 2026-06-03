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
  const upcoming = board.filter((f) => !f.locked && f.home && f.away);
  const selected = upcoming.find((f) => f.id === fixtureParam) ?? upcoming[0];

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

  // Group the (already chronological) upcoming fixtures by German calendar day
  // for the picker's optgroups. No truncation — the full schedule is selectable.
  const groups: FixtureGroup[] = [];
  for (const f of upcoming) {
    const heading = formatDayHeading(f.kickoffAt);
    const label = `${formatTime(f.kickoffAt)} · ${f.home?.shortName ?? f.home?.name ?? "?"} – ${
      f.away?.shortName ?? f.away?.name ?? "?"
    }`;
    const key = berlinDayKey(f.kickoffAt);
    const last = groups.at(-1);
    if (last && last.key === key) last.options.push({ id: f.id, label });
    else groups.push({ key, heading, options: [{ id: f.id, label }] });
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">{de.admin.enterTips}</h2>

      {upcoming.length === 0 ? (
        <p className="text-muted-foreground text-sm">{de.admin.tipsNoFixtures}</p>
      ) : (
        <div className="space-y-3">
          <p className="text-muted-foreground text-sm">{de.admin.tipsPickFixture}</p>
          <FixturePicker base={base} selectedId={selected?.id ?? ""} groups={groups} />
          {selected && (
            <MemberTipTable
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
