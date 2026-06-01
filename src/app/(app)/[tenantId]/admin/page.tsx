import Link from "next/link";

import {
  CreateInviteForm,
  DeleteInviteButton,
  MemberRowActions,
  MemberTippingForm,
  ScoringForm,
  type ScoringValues,
} from "@/components/admin/admin-forms";
import { InviteShare } from "@/components/admin/invite-share";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requireAdmin } from "@/lib/auth/membership";
import { cn } from "@/lib/utils";
import { de } from "@/messages/de";

export const metadata = { title: de.admin.title };

const TABS = ["members", "invites", "scoring", "settings"] as const;
type Tab = (typeof TABS)[number];
const TAB_LABEL: Record<Tab, string> = {
  members: de.admin.members,
  invites: de.admin.invites,
  scoring: de.admin.scoring,
  settings: de.admin.settingsTab,
};
const MEMBERS_PER_PAGE = 20;

export default async function AdminPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantId: string }>;
  searchParams: Promise<{ tab?: string; q?: string; page?: string }>;
}) {
  const { tenantId } = await params;
  const sp = await searchParams;
  const tab: Tab = TABS.includes(sp.tab as Tab) ? (sp.tab as Tab) : "members";
  const query = (sp.q ?? "").trim();

  const membership = await requireAdmin(tenantId);
  const { supabase } = membership;
  const base = `/${tenantId}/admin`;

  return (
    <div className="space-y-4">
      <nav className="flex flex-wrap gap-1 border-b text-sm">
        {TABS.map((t) => (
          <Link
            key={t}
            href={`${base}?tab=${t}`}
            className={cn(
              "-mb-px rounded-t-md px-3 py-1.5 whitespace-nowrap",
              t === tab
                ? "border-primary text-foreground border-b-2 font-medium"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {TAB_LABEL[t]}
          </Link>
        ))}
      </nav>

      {tab === "members" && (
        <MembersTab
          supabase={supabase}
          tenantId={tenantId}
          query={query}
          page={Number(sp.page) || 1}
          base={base}
        />
      )}
      {tab === "invites" && <InvitesTab supabase={supabase} tenantId={tenantId} />}
      {tab === "scoring" && <ScoringTab supabase={supabase} tenantId={tenantId} />}
      {tab === "settings" && (
        <div className="rounded-md border p-4">
          <MemberTippingForm tenantId={tenantId} enabled={membership.memberTippingEnabled} />
        </div>
      )}
    </div>
  );
}

type SupabaseClient = Awaited<ReturnType<typeof requireAdmin>>["supabase"];

async function MembersTab({
  supabase,
  tenantId,
  query,
  page,
  base,
}: {
  supabase: SupabaseClient;
  tenantId: string;
  query: string;
  page: number;
  base: string;
}) {
  const { data: members } = await supabase
    .from("tenant_member")
    .select("user_id, role")
    .eq("tenant_id", tenantId);
  const memberIds = (members ?? []).map((m) => m.user_id);
  const { data: profiles } = memberIds.length
    ? await supabase.from("profile").select("user_id, display_name").in("user_id", memberIds)
    : { data: [] };
  const nameById = new Map((profiles ?? []).map((p) => [p.user_id, p.display_name]));

  // Admins first, then alphabetically by display name.
  const rows = (members ?? [])
    .map((m) => ({ ...m, name: nameById.get(m.user_id) ?? "—" }))
    .filter((m) => (query ? m.name.toLowerCase().includes(query.toLowerCase()) : true))
    .sort((a, b) => {
      if (a.role !== b.role) return a.role === "admin" ? -1 : 1;
      return a.name.localeCompare(b.name, "de");
    });

  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / MEMBERS_PER_PAGE));
  const current = Math.min(Math.max(1, page), totalPages);
  const pageRows = rows.slice((current - 1) * MEMBERS_PER_PAGE, current * MEMBERS_PER_PAGE);

  const pageHref = (p: number) =>
    `${base}?tab=members${query ? `&q=${encodeURIComponent(query)}` : ""}&page=${p}`;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <form method="get" className="flex flex-1 gap-2">
          <input type="hidden" name="tab" value="members" />
          <Input
            name="q"
            defaultValue={query}
            placeholder={de.admin.memberSearchPlaceholder}
            aria-label={de.admin.memberSearch}
            className="max-w-xs"
          />
          <Button type="submit" size="sm" variant="outline">
            {de.admin.memberSearch}
          </Button>
        </form>
        <span className="text-muted-foreground shrink-0 text-xs">
          {de.admin.memberCount(total)}
        </span>
      </div>

      {pageRows.length === 0 ? (
        <p className="text-muted-foreground text-sm">{de.admin.noMembers}</p>
      ) : (
        <ul className="divide-y rounded-md border">
          {pageRows.map((m) => (
            <li key={m.user_id} className="flex items-center justify-between gap-3 px-3 py-2">
              <span className="flex min-w-0 items-center gap-2 text-sm">
                <span className="truncate">{m.name}</span>
                <Badge variant={m.role === "admin" ? "default" : "secondary"}>
                  {de.groups.role[m.role]}
                </Badge>
              </span>
              <MemberRowActions tenantId={tenantId} targetUserId={m.user_id} role={m.role} />
            </li>
          ))}
        </ul>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          {current > 1 ? (
            <Link href={pageHref(current - 1)} className="text-primary">
              ← {de.admin.pagePrev}
            </Link>
          ) : (
            <span className="text-muted-foreground">← {de.admin.pagePrev}</span>
          )}
          <span className="text-muted-foreground text-xs">
            {de.admin.pageInfo(current, totalPages)}
          </span>
          {current < totalPages ? (
            <Link href={pageHref(current + 1)} className="text-primary">
              {de.admin.pageNext} →
            </Link>
          ) : (
            <span className="text-muted-foreground">{de.admin.pageNext} →</span>
          )}
        </div>
      )}
    </div>
  );
}

async function InvitesTab({
  supabase,
  tenantId,
}: {
  supabase: SupabaseClient;
  tenantId: string;
}) {
  const { data: invites } = await supabase
    .from("tenant_invite")
    .select("code, used_count, max_uses, role")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-4">
      <div className="rounded-md border p-3">
        <CreateInviteForm tenantId={tenantId} />
      </div>
      {(invites ?? []).length === 0 ? (
        <p className="text-muted-foreground text-sm">{de.admin.inviteEmpty}</p>
      ) : (
        <ul className="divide-y rounded-md border text-sm">
          {(invites ?? []).map((inv) => (
            <li key={inv.code} className="space-y-2 px-3 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <code className="bg-muted rounded px-2 py-0.5 font-mono">{inv.code}</code>
                  {inv.role === "admin" && <Badge>{de.groups.role.admin}</Badge>}
                </span>
                <span className="flex items-center gap-3">
                  <span className="text-muted-foreground text-xs">
                    {de.admin.uses}: {inv.used_count}
                    {inv.max_uses != null ? `/${inv.max_uses}` : ` (${de.admin.inviteUnlimited})`}
                  </span>
                  <DeleteInviteButton tenantId={tenantId} code={inv.code} />
                </span>
              </div>
              <InviteShare code={inv.code} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

async function ScoringTab({
  supabase,
  tenantId,
}: {
  supabase: SupabaseClient;
  tenantId: string;
}) {
  const { data: ruleSet } = await supabase
    .from("scoring_rule_set")
    .select("config")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .maybeSingle();
  const config = (ruleSet?.config ?? {}) as Record<string, number>;
  const scoringValues: ScoringValues = {
    exact: config.exact ?? 3,
    goalDiff: config.goal_diff ?? 2,
    tendency: config.tendency ?? 1,
    advanceBonus: config.advance_bonus ?? 2,
  };

  return (
    <div className="rounded-md border p-4">
      <ScoringForm tenantId={tenantId} values={scoringValues} />
    </div>
  );
}
