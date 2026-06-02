"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { invalidateTags } from "@/lib/cache/cache";
import { isSiteAdmin } from "@/lib/auth/membership";
import { getAppSettings } from "@/lib/data/settings";
import { createClient } from "@/lib/supabase/server";
import { de } from "@/messages/de";
import { logActionError, type ActionState } from "@/actions/types";

const createSchema = z.object({
  name: z.string().trim().min(2).max(80),
});

export async function createGroupAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = createSchema.safeParse({
    name: formData.get("name"),
  });
  if (!parsed.success) return { error: de.groups.createError };

  const supabase = await createClient();

  // Honour the global toggle; site admins always bypass it. The create_group
  // RPC enforces this again as the non-bypassable gate.
  const { groupCreationEnabled } = await getAppSettings(supabase);
  if (!groupCreationEnabled && !(await isSiteAdmin(supabase))) {
    return { error: de.groups.createDisabled };
  }

  const { data, error } = await supabase.rpc("create_group", {
    p_name: parsed.data.name,
  });
  if (error || !data) return { error: de.groups.createError };

  redirect(`/${data.id}`);
}

const deleteGroupSchema = z.object({
  tenantId: z.string().uuid(),
  confirmName: z.string().trim().min(1).max(80),
});

/**
 * Permanently delete a group. Admin-only (re-resolved here as defense-in-depth;
 * the tenant_delete RLS policy + the MFA RESTRICTIVE policy are the final gate).
 * The typed-name confirmation guards against accidental deletion. All child rows
 * (members, predictions, scores, invites, …) cascade away via FK; the
 * min-one-admin trigger skips while the tenant itself is being deleted.
 */
export async function deleteGroupAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = deleteGroupSchema.safeParse({
    tenantId: formData.get("tenantId"),
    confirmName: formData.get("confirmName"),
  });
  if (!parsed.success) return { error: de.admin.deleteGroupError };

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return { error: de.admin.deleteGroupError };

  const { data: tenant } = await supabase
    .from("tenant")
    .select("name")
    .eq("id", parsed.data.tenantId)
    .maybeSingle();
  const { data: member } = await supabase
    .from("tenant_member")
    .select("role")
    .eq("tenant_id", parsed.data.tenantId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!tenant || member?.role !== "admin") return { error: de.admin.deleteGroupError };

  if (parsed.data.confirmName !== tenant.name) {
    return { error: de.admin.deleteGroupNameMismatch };
  }

  const { error } = await supabase.from("tenant").delete().eq("id", parsed.data.tenantId);
  if (error) {
    logActionError("deleteGroup", error);
    return { error: de.admin.deleteGroupError };
  }

  await invalidateTags(`leaderboard:${parsed.data.tenantId}`);
  redirect("/groups");
}

const joinSchema = z.object({ code: z.string().trim().min(1).max(64) });

export async function joinGroupAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = joinSchema.safeParse({ code: formData.get("code") });
  if (!parsed.success) return { error: de.groups.joinError };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("redeem_invite", { p_code: parsed.data.code });
  if (error || !data) return { error: de.groups.joinError };

  redirect(`/${data.id}`);
}
