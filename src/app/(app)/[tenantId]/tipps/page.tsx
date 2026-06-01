import Link from "next/link";

import { MemberTipTable, type MemberTipRow } from "@/components/admin/admin-forms";
import { requireAdmin } from "@/lib/auth/membership";
import { getFixtureBoard } from "@/lib/data/fixtures";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
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
  const { supabase, userId } = membership;
  const base = `/${tenantId}/tipps`;

  const board = await getFixtureBoard(supabase, tenantId, userId);
  const upcoming = board.filter((f) => !f.locked && f.home && f.away);
  const selected = upcoming.find((f) => f.id === fixtureParam) ?? upcoming[0];

  const { data: members } = await supabase
    .from("tenant_member")
    .select("user_id")
    .eq("tenant_id", tenantId);
  const memberIds = (members ?? []).map((m) => m.user_id);
  const { data: profiles } = memberIds.length
    ? await supabase.from("profile").select("user_id, display_name").in("user_id", memberIds)
    : { data: [] };
  const nameById = new Map((profiles ?? []).map((p) => [p.user_id, p.display_name]));

  const { data: preds } = selected
    ? await supabase
        .from("prediction")
        .select("user_id, home_goals, away_goals")
        .eq("tenant_id", tenantId)
        .eq("fixture_id", selected.id)
    : { data: [] };
  const predByUser = new Map((preds ?? []).map((p) => [p.user_id, p]));

  const rows: MemberTipRow[] = (members ?? [])
    .map((m) => ({
      userId: m.user_id,
      name: nameById.get(m.user_id) ?? "—",
      home: predByUser.get(m.user_id)?.home_goals ?? null,
      away: predByUser.get(m.user_id)?.away_goals ?? null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "de"));

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">{de.admin.enterTips}</h2>

      {upcoming.length === 0 ? (
        <p className="text-muted-foreground text-sm">{de.admin.tipsNoFixtures}</p>
      ) : (
        <div className="space-y-3">
          <p className="text-muted-foreground text-sm">{de.admin.tipsPickFixture}</p>
          <div className="flex flex-wrap gap-2">
            {upcoming.slice(0, 30).map((f) => (
              <Link
                key={f.id}
                href={`${base}?fixture=${f.id}`}
                className={cn(
                  "cursor-pointer rounded-md border px-2 py-1 text-xs whitespace-nowrap",
                  selected?.id === f.id
                    ? "border-primary bg-primary/10 font-medium"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {f.home?.shortName ?? f.home?.name ?? "?"} –{" "}
                {f.away?.shortName ?? f.away?.name ?? "?"} · {formatDateTime(f.kickoffAt)}
              </Link>
            ))}
          </div>
          {selected && (
            <MemberTipTable
              tenantId={tenantId}
              fixtureId={selected.id}
              homeName={selected.home?.name ?? "?"}
              awayName={selected.away?.name ?? "?"}
              members={rows}
            />
          )}
        </div>
      )}
    </div>
  );
}
