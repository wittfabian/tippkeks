import "server-only";

import type { ServerClient } from "@/lib/supabase/server";

export interface TenantMember {
  userId: string;
  displayName: string;
  role: "admin" | "member";
  managed: boolean;
}

/**
 * Full member roster of a tenant (role + managed flag + display name), via the
 * caller's RLS-scoped client. Centralises the `tenant_member` → `profile` join
 * that the admin members tab and the name-only `getMemberNames` both need.
 */
export async function getTenantMembers(
  supabase: ServerClient,
  tenantId: string,
): Promise<TenantMember[]> {
  const { data: members, error: memberError } = await supabase
    .from("tenant_member")
    .select("user_id, role")
    .eq("tenant_id", tenantId);
  if (memberError) console.error("[data:members] member query failed", memberError);

  const ids = (members ?? []).map((m) => m.user_id);
  if (ids.length === 0) return [];

  const { data: profiles, error: profileError } = await supabase
    .from("profile")
    .select("user_id, display_name, managed")
    .in("user_id", ids);
  if (profileError) console.error("[data:members] profile query failed", profileError);

  const profileById = new Map((profiles ?? []).map((p) => [p.user_id, p]));
  return (members ?? []).map((m) => ({
    userId: m.user_id,
    displayName: profileById.get(m.user_id)?.display_name ?? "—",
    role: m.role,
    managed: profileById.get(m.user_id)?.managed ?? false,
  }));
}

/**
 * Map of `user_id → display_name` for every member of a tenant (including
 * managed members). Thin wrapper over getTenantMembers for the pages that only
 * need names (match detail, enter-tips).
 */
export async function getMemberNames(
  supabase: ServerClient,
  tenantId: string,
): Promise<Map<string, string>> {
  const members = await getTenantMembers(supabase, tenantId);
  return new Map(members.map((m) => [m.userId, m.displayName]));
}
