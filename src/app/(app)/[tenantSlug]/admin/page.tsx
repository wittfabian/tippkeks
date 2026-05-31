import {
  CreateInviteButton,
  MemberRowActions,
  ResultForm,
  ScoringForm,
  type ScoringValues,
} from "@/components/admin/admin-forms";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth/membership";
import { getFixtureBoard } from "@/lib/data/fixtures";
import { formatDateTime } from "@/lib/format";
import { de } from "@/messages/de";

export const metadata = { title: de.admin.title };

export default async function AdminPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await params;
  const membership = await requireAdmin(tenantSlug);
  const { supabase, tenantId } = membership;

  const { data: members } = await supabase
    .from("tenant_member")
    .select("user_id, role")
    .eq("tenant_id", tenantId);
  const memberIds = (members ?? []).map((m) => m.user_id);
  const { data: profiles } = memberIds.length
    ? await supabase.from("profile").select("user_id, display_name").in("user_id", memberIds)
    : { data: [] };
  const nameById = new Map((profiles ?? []).map((p) => [p.user_id, p.display_name]));

  const { data: invites } = await supabase
    .from("tenant_invite")
    .select("code, used_count, max_uses, expires_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  const { data: ruleSet } = await supabase
    .from("scoring_rule_set")
    .select("config")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .maybeSingle();
  const config = (ruleSet?.config ?? {}) as Record<string, number>;
  const scoringValues: ScoringValues = {
    exact: config.exact ?? 4,
    goalDiff: config.goal_diff ?? 3,
    tendency: config.tendency ?? 2,
    advanceBonus: config.advance_bonus ?? 2,
  };

  const board = await getFixtureBoard(supabase, tenantId, membership.userId);
  const needsResult = board.filter((f) => f.locked && f.status !== "finished" && f.home && f.away);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">{de.admin.members}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <ul className="divide-y">
            {(members ?? []).map((m) => (
              <li key={m.user_id} className="flex items-center justify-between gap-3 py-2">
                <span className="flex items-center gap-2 text-sm">
                  {nameById.get(m.user_id) ?? "—"}
                  <Badge variant={m.role === "admin" ? "default" : "secondary"}>
                    {de.groups.role[m.role]}
                  </Badge>
                </span>
                <MemberRowActions
                  tenantId={tenantId}
                  slug={tenantSlug}
                  targetUserId={m.user_id}
                  role={m.role}
                />
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{de.admin.invites}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <CreateInviteButton tenantId={tenantId} slug={tenantSlug} />
          {(invites ?? []).length > 0 && (
            <ul className="space-y-1 text-sm">
              {(invites ?? []).map((inv) => (
                <li key={inv.code} className="flex items-center justify-between gap-2">
                  <code className="bg-muted rounded px-2 py-0.5 font-mono">{inv.code}</code>
                  <span className="text-muted-foreground text-xs">
                    {de.admin.uses}: {inv.used_count}
                    {inv.max_uses != null ? `/${inv.max_uses}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{de.admin.scoring}</CardTitle>
        </CardHeader>
        <CardContent>
          <ScoringForm tenantId={tenantId} slug={tenantSlug} values={scoringValues} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{de.admin.results}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {needsResult.length === 0 ? (
            <p className="text-muted-foreground text-sm">{de.empty.noFixtures}</p>
          ) : (
            <ul className="space-y-3">
              {needsResult.map((f) => (
                <li key={f.id} className="space-y-1">
                  <p className="text-muted-foreground text-xs">{formatDateTime(f.kickoffAt)} Uhr</p>
                  <ResultForm
                    tenantId={tenantId}
                    slug={tenantSlug}
                    fixtureId={f.id}
                    homeName={f.home?.name ?? "?"}
                    awayName={f.away?.name ?? "?"}
                  />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
