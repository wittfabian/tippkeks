"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { de } from "@/messages/de";
import type { ActionState } from "@/actions/types";

const tenantField = z.object({ tenantId: z.string().uuid(), slug: z.string().min(1) });

/** Generate a short, readable invite code. */
function generateInviteCode(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
}

export async function createInviteAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = tenantField.safeParse({
    tenantId: formData.get("tenantId"),
    slug: formData.get("slug"),
  });
  if (!parsed.success) return { error: de.auth.errorGeneric };

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return { error: de.auth.errorGeneric };

  // RLS only lets a tenant admin insert here.
  const { error } = await supabase.from("tenant_invite").insert({
    tenant_id: parsed.data.tenantId,
    code: generateInviteCode(),
    role: "member",
    created_by: userId,
  });
  if (error) return { error: de.auth.errorGeneric };

  await supabase.from("admin_audit_log").insert({
    tenant_id: parsed.data.tenantId,
    actor_id: userId,
    action: "invite_create",
  });

  revalidatePath(`/${parsed.data.slug}/admin`);
  return { error: null, info: de.admin.inviteCreated };
}

const roleSchema = tenantField.extend({
  targetUserId: z.string().uuid(),
  role: z.enum(["admin", "member"]),
});

export async function setMemberRoleAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = roleSchema.safeParse({
    tenantId: formData.get("tenantId"),
    slug: formData.get("slug"),
    targetUserId: formData.get("targetUserId"),
    role: formData.get("role"),
  });
  if (!parsed.success) return { error: de.auth.errorGeneric };

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const actorId = claims?.claims?.sub;
  if (!actorId) return { error: de.auth.errorGeneric };

  const { error } = await supabase
    .from("tenant_member")
    .update({ role: parsed.data.role })
    .eq("tenant_id", parsed.data.tenantId)
    .eq("user_id", parsed.data.targetUserId);
  if (error) {
    return { error: /Admin/.test(error.message) ? de.admin.lastAdminError : de.auth.errorGeneric };
  }

  await supabase.from("admin_audit_log").insert({
    tenant_id: parsed.data.tenantId,
    actor_id: actorId,
    action: "role_change",
    target_type: "user",
    target_id: parsed.data.targetUserId,
    detail: { role: parsed.data.role },
  });

  revalidatePath(`/${parsed.data.slug}/admin`);
  return { error: null, info: null };
}

const removeSchema = tenantField.extend({ targetUserId: z.string().uuid() });

export async function removeMemberAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = removeSchema.safeParse({
    tenantId: formData.get("tenantId"),
    slug: formData.get("slug"),
    targetUserId: formData.get("targetUserId"),
  });
  if (!parsed.success) return { error: de.auth.errorGeneric };

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const actorId = claims?.claims?.sub;
  if (!actorId) return { error: de.auth.errorGeneric };

  const { error } = await supabase
    .from("tenant_member")
    .delete()
    .eq("tenant_id", parsed.data.tenantId)
    .eq("user_id", parsed.data.targetUserId);
  if (error) {
    return { error: /Admin/.test(error.message) ? de.admin.lastAdminError : de.auth.errorGeneric };
  }

  await supabase.from("admin_audit_log").insert({
    tenant_id: parsed.data.tenantId,
    actor_id: actorId,
    action: "member_remove",
    target_type: "user",
    target_id: parsed.data.targetUserId,
  });

  revalidatePath(`/${parsed.data.slug}/admin`);
  return { error: null, info: null };
}

const scoringSchema = tenantField.extend({
  exact: z.coerce.number().int().min(0).max(100),
  goalDiff: z.coerce.number().int().min(0).max(100),
  tendency: z.coerce.number().int().min(0).max(100),
  advanceBonus: z.coerce.number().int().min(0).max(100),
});

export async function saveScoringAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = scoringSchema.safeParse({
    tenantId: formData.get("tenantId"),
    slug: formData.get("slug"),
    exact: formData.get("exact"),
    goalDiff: formData.get("goalDiff"),
    tendency: formData.get("tendency"),
    advanceBonus: formData.get("advanceBonus"),
  });
  if (!parsed.success) return { error: de.auth.errorGeneric };

  const supabase = await createClient();

  // Preserve any configured per-stage multipliers.
  const { data: active } = await supabase
    .from("scoring_rule_set")
    .select("id, config")
    .eq("tenant_id", parsed.data.tenantId)
    .eq("is_active", true)
    .maybeSingle();
  if (!active) return { error: de.auth.errorGeneric };

  const existing = (active.config ?? {}) as { stage_multipliers?: Record<string, number> };
  const config = {
    exact: parsed.data.exact,
    goal_diff: parsed.data.goalDiff,
    tendency: parsed.data.tendency,
    advance_bonus: parsed.data.advanceBonus,
    stage_multipliers: existing.stage_multipliers ?? {},
  };

  const { error: updateError } = await supabase
    .from("scoring_rule_set")
    .update({ config })
    .eq("id", active.id);
  if (updateError) return { error: de.auth.errorGeneric };

  // Recompute every finished fixture for this tenant (admin-checked in SQL).
  const { error: recomputeError } = await supabase.rpc("recompute_tenant", {
    p_tenant: parsed.data.tenantId,
  });
  if (recomputeError) return { error: de.auth.errorGeneric };

  revalidatePath(`/${parsed.data.slug}`);
  return { error: null, info: de.admin.scoringSaved };
}

const resultSchema = tenantField.extend({
  fixtureId: z.coerce.number().int().positive(),
  homeGoals: z.coerce.number().int().min(0).max(99),
  awayGoals: z.coerce.number().int().min(0).max(99),
});

/**
 * Manually enter/override a fixture's regulation result and score it. Fixtures
 * are shared reference data, so this uses the service role AFTER verifying the
 * caller is an admin of a tenant subscribed to the fixture's season. Note: the
 * result is global (affects every tenant playing that season) — this is the
 * deliberate fallback for provider lag/outage, not routine editing.
 */
export async function overrideResultAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = resultSchema.safeParse({
    tenantId: formData.get("tenantId"),
    slug: formData.get("slug"),
    fixtureId: formData.get("fixtureId"),
    homeGoals: formData.get("homeGoals"),
    awayGoals: formData.get("awayGoals"),
  });
  if (!parsed.success) return { error: de.admin.resultError };

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return { error: de.admin.resultError };

  // Verify the caller is an admin of this tenant.
  const { data: membership } = await supabase
    .from("tenant_member")
    .select("role")
    .eq("tenant_id", parsed.data.tenantId)
    .eq("user_id", userId)
    .maybeSingle();
  if (membership?.role !== "admin") return { error: de.admin.resultError };

  // Verify the fixture belongs to a season the tenant is subscribed to.
  const { data: fixture } = await supabase
    .from("fixture")
    .select("id, season_id, home_team_id, away_team_id")
    .eq("id", parsed.data.fixtureId)
    .maybeSingle();
  if (!fixture) return { error: de.admin.resultError };

  const { data: subscribed } = await supabase
    .from("tenant_season")
    .select("season_id")
    .eq("tenant_id", parsed.data.tenantId)
    .eq("season_id", fixture.season_id)
    .maybeSingle();
  if (!subscribed) return { error: de.admin.resultError };

  const winnerTeamId =
    parsed.data.homeGoals > parsed.data.awayGoals
      ? fixture.home_team_id
      : parsed.data.awayGoals > parsed.data.homeGoals
        ? fixture.away_team_id
        : null;

  // Privileged write: fixtures have no authenticated write policy by design.
  const service = createServiceClient();
  const { error: updateError } = await service
    .from("fixture")
    .update({
      regular_home: parsed.data.homeGoals,
      regular_away: parsed.data.awayGoals,
      status: "finished",
      after_extra_time: false,
      winner_team_id: winnerTeamId,
    })
    .eq("id", parsed.data.fixtureId);
  if (updateError) return { error: de.admin.resultError };

  const { error: scoreError } = await service.rpc("score_fixture", {
    p_fixture: parsed.data.fixtureId,
  });
  if (scoreError) return { error: de.admin.resultError };

  await supabase.from("admin_audit_log").insert({
    tenant_id: parsed.data.tenantId,
    actor_id: userId,
    action: "result_override",
    target_type: "fixture",
    target_id: String(parsed.data.fixtureId),
    detail: { home: parsed.data.homeGoals, away: parsed.data.awayGoals },
  });

  revalidatePath(`/${parsed.data.slug}`);
  return { error: null, info: de.admin.resultSaved };
}
