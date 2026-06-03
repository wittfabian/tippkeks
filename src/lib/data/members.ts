import "server-only";

import type { ServerClient } from "@/lib/supabase/server";

/**
 * Map of `user_id → display_name` for every member of a tenant (including
 * managed members). Read through the caller's RLS-scoped client. Centralises the
 * member-roster + profile join that several tenant pages need.
 */
export async function getMemberNames(
  supabase: ServerClient,
  tenantId: string,
): Promise<Map<string, string>> {
  const { data: members, error: memberError } = await supabase
    .from("tenant_member")
    .select("user_id")
    .eq("tenant_id", tenantId);
  if (memberError) console.error("[data:members] member query failed", memberError);

  const ids = (members ?? []).map((m) => m.user_id);
  if (ids.length === 0) return new Map();

  const { data: profiles, error: profileError } = await supabase
    .from("profile")
    .select("user_id, display_name")
    .in("user_id", ids);
  if (profileError) console.error("[data:members] profile query failed", profileError);

  return new Map((profiles ?? []).map((p) => [p.user_id, p.display_name]));
}
