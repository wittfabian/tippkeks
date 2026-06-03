"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { invalidateTags } from "@/lib/cache/cache";
import { isSiteAdmin } from "@/lib/auth/membership";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { de } from "@/messages/de";
import { logActionError, type ActionState } from "@/actions/types";

const tenantField = z.object({ tenantId: z.string().uuid() });

/** Postgres SQLSTATE for a CHECK/`check_violation` raise (e.g. the min-one-admin trigger). */
const CHECK_VIOLATION = "23514";

/**
 * Non-deliverable domain for the synthetic email a managed member's auth user
 * carries. It deliberately has no MX record — no mail is ever sent here (managed
 * members have no password and never trigger a reset), so accidental delivery is
 * impossible. Kept distinct from the real sending domain on purpose.
 */
const MANAGED_EMAIL_DOMAIN = "managed.tippkeks.de";

/** Supabase auth error code when an email is already taken by another account. */
const EMAIL_EXISTS = "email_exists";

/** Generate a short, readable invite code. */
function generateInviteCode(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
}

/**
 * Re-resolve that the current user is an admin of the tenant (defense-in-depth
 * layer 2 — RLS is still the final gate). Returns the userId when admin, else null.
 */
async function adminUserId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string,
): Promise<string | null> {
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return null;
  const { data } = await supabase
    .from("tenant_member")
    .select("role")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .maybeSingle();
  return data?.role === "admin" ? userId : null;
}

/**
 * Like adminUserId but also accepts a site admin (operator) who is not a member
 * of the tenant. Used for managed-member management, which the operator may do
 * for any group. Returns the acting userId, or null when neither.
 */
async function adminOrSiteAdminUserId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string,
): Promise<string | null> {
  const userId = await adminUserId(supabase, tenantId);
  if (userId) return userId;
  const { data: claims } = await supabase.auth.getClaims();
  const siteUserId = claims?.claims?.sub;
  if (!siteUserId) return null;
  return (await isSiteAdmin(supabase)) ? siteUserId : null;
}

const createInviteSchema = tenantField.extend({
  // Empty input → undefined → unlimited uses.
  maxUses: z.coerce.number().int().positive().max(100_000).optional(),
  asAdmin: z.coerce.boolean().optional(),
});

export async function createInviteAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = createInviteSchema.safeParse({
    tenantId: formData.get("tenantId"),
    maxUses: formData.get("maxUses") || undefined,
    asAdmin: formData.get("asAdmin") === "on",
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
    role: parsed.data.asAdmin ? "admin" : "member",
    max_uses: parsed.data.maxUses ?? null,
    created_by: userId,
  });
  if (error) return { error: de.auth.errorGeneric };

  await supabase.from("admin_audit_log").insert({
    tenant_id: parsed.data.tenantId,
    actor_id: userId,
    action: "invite_create",
  });

  revalidatePath(`/${parsed.data.tenantId}/admin`);
  return { error: null, info: de.admin.inviteCreated };
}

const deleteInviteSchema = tenantField.extend({ code: z.string().min(1).max(64) });

export async function deleteInviteAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = deleteInviteSchema.safeParse({
    tenantId: formData.get("tenantId"),
    code: formData.get("code"),
  });
  if (!parsed.success) return { error: de.auth.errorGeneric };

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return { error: de.auth.errorGeneric };

  // RLS only lets a tenant admin delete here.
  const { error } = await supabase
    .from("tenant_invite")
    .delete()
    .eq("tenant_id", parsed.data.tenantId)
    .eq("code", parsed.data.code);
  if (error) return { error: de.auth.errorGeneric };

  revalidatePath(`/${parsed.data.tenantId}/admin`);
  return { error: null, info: de.admin.inviteDeleted };
}

const memberTippingSchema = tenantField.extend({ enabled: z.boolean() });

/** Toggle whether members may submit their own predictions (admins always can). */
export async function setMemberTippingAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = memberTippingSchema.safeParse({
    tenantId: formData.get("tenantId"),
    enabled: formData.get("enabled") === "on",
  });
  if (!parsed.success) return { error: de.auth.errorGeneric };

  const supabase = await createClient();
  if (!(await adminUserId(supabase, parsed.data.tenantId))) return { error: de.auth.errorGeneric };

  // RLS also enforces that only a tenant admin may update the tenant row.
  const { error } = await supabase
    .from("tenant")
    .update({ member_tipping_enabled: parsed.data.enabled })
    .eq("id", parsed.data.tenantId);
  if (error) {
    logActionError("setMemberTipping", error);
    return { error: de.auth.errorGeneric };
  }

  revalidatePath(`/${parsed.data.tenantId}/admin`);
  revalidatePath(`/${parsed.data.tenantId}/matches`);
  return { error: null, info: de.admin.memberTippingSaved };
}

const memberTipsSchema = tenantField.extend({
  fixtureId: z.string().uuid(),
  userIds: z.string().min(1),
});

/**
 * Bulk-enter predictions for members of a fixture (one row per member in the
 * admin table). Empty rows are skipped; a half-filled row is rejected. The
 * deadline trigger and RLS (admin-writes-for-members) remain the real gates.
 * advancing_team_id is intentionally omitted so an existing knockout pick is
 * preserved on update.
 */
export async function saveMemberTipsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = memberTipsSchema.safeParse({
    tenantId: formData.get("tenantId"),
    fixtureId: formData.get("fixtureId"),
    userIds: formData.get("userIds"),
  });
  if (!parsed.success) return { error: de.admin.tipsError };

  const supabase = await createClient();
  if (!(await adminUserId(supabase, parsed.data.tenantId))) return { error: de.admin.tipsError };

  // userIds is a client-supplied hidden field — validate each is a real UUID
  // before trusting it (RLS still rejects non-members, this fails fast/clearer).
  const uuidSchema = z.string().uuid();
  const userIds = parsed.data.userIds.split(",").filter(Boolean);
  if (!userIds.every((u) => uuidSchema.safeParse(u).success)) return { error: de.admin.tipsError };

  const rowSchema = z.coerce.number().int().min(0).max(99);
  const rows: {
    tenant_id: string;
    user_id: string;
    fixture_id: string;
    home_goals: number;
    away_goals: number;
  }[] = [];

  for (const uid of userIds) {
    const homeRaw = (formData.get(`home_${uid}`) ?? "").toString().trim();
    const awayRaw = (formData.get(`away_${uid}`) ?? "").toString().trim();
    if (homeRaw === "" && awayRaw === "") continue; // untouched row
    const home = rowSchema.safeParse(homeRaw);
    const away = rowSchema.safeParse(awayRaw);
    if (!home.success || !away.success) return { error: de.admin.tipsError };
    rows.push({
      tenant_id: parsed.data.tenantId,
      user_id: uid,
      fixture_id: parsed.data.fixtureId,
      home_goals: home.data,
      away_goals: away.data,
    });
  }

  if (rows.length === 0) return { error: null, info: de.admin.tipsSaved(0) };

  // RLS lets an admin write for any member; the deadline trigger still applies.
  // The upsert is one statement: if any row trips the deadline, the whole batch
  // fails (acceptable — every row shares the same fixture/kickoff).
  const { error } = await supabase
    .from("prediction")
    .upsert(rows, { onConflict: "tenant_id,user_id,fixture_id" });
  if (error) {
    logActionError("saveMemberTips", error);
    return { error: de.admin.tipsError };
  }

  await invalidateTags(`tip-pulse:${parsed.data.tenantId}`);
  revalidatePath(`/${parsed.data.tenantId}/admin`);
  revalidatePath(`/${parsed.data.tenantId}/matches`);
  return { error: null, info: de.admin.tipsSaved(rows.length) };
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
    // The min-one-admin trigger raises check_violation (23514); other errors are generic.
    if (error.code === CHECK_VIOLATION) return { error: de.admin.lastAdminError };
    logActionError("setMemberRole", error);
    return { error: de.auth.errorGeneric };
  }

  await supabase.from("admin_audit_log").insert({
    tenant_id: parsed.data.tenantId,
    actor_id: actorId,
    action: "role_change",
    target_type: "user",
    target_id: parsed.data.targetUserId,
    detail: { role: parsed.data.role },
  });

  revalidatePath(`/${parsed.data.tenantId}/admin`);
  return { error: null, info: null };
}

const removeSchema = tenantField.extend({ targetUserId: z.string().uuid() });

export async function removeMemberAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = removeSchema.safeParse({
    tenantId: formData.get("tenantId"),
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
    if (error.code === CHECK_VIOLATION) return { error: de.admin.lastAdminError };
    logActionError("removeMember", error);
    return { error: de.auth.errorGeneric };
  }

  await supabase.from("admin_audit_log").insert({
    tenant_id: parsed.data.tenantId,
    actor_id: actorId,
    action: "member_remove",
    target_type: "user",
    target_id: parsed.data.targetUserId,
  });

  revalidatePath(`/${parsed.data.tenantId}/admin`);
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

  // Recompute only touched this tenant's scores.
  await invalidateTags(`leaderboard:${parsed.data.tenantId}`);

  revalidatePath(`/${parsed.data.tenantId}`);
  return { error: null, info: de.admin.scoringSaved };
}

const createManagedSchema = tenantField.extend({
  displayName: z.string().trim().min(1).max(80),
});

/**
 * Create a "managed member": a participant the admin tips for, who never logs
 * in. Implemented as a real auth user with a synthetic, non-deliverable email
 * and no password (so sign-in is impossible and no mail is sent), flagged via
 * profile.managed. From there the existing membership/prediction/scoring/
 * leaderboard machinery applies unchanged — incl. the admin-writes-for-member
 * RLS policy. Privileged work (auth user + flag + membership) runs under the
 * service role AFTER an admin/site-admin check (the action is the trust boundary).
 */
export async function createManagedMemberAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = createManagedSchema.safeParse({
    tenantId: formData.get("tenantId"),
    displayName: formData.get("displayName"),
  });
  if (!parsed.success) return { error: de.admin.managedCreateError };

  const supabase = await createClient();
  const actorId = await adminOrSiteAdminUserId(supabase, parsed.data.tenantId);
  if (!actorId) return { error: de.admin.managedCreateError };

  const service = createServiceClient();

  // Synthetic, unique, non-deliverable address; email_confirm avoids any
  // confirmation mail; no password → the account can never sign in. The
  // on_auth_user_created trigger provisions the profile from display_name.
  const email = `managed-${crypto.randomUUID()}@${MANAGED_EMAIL_DOMAIN}`;
  const { data: created, error: createError } = await service.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { display_name: parsed.data.displayName },
  });
  if (createError || !created?.user) {
    logActionError("createManagedMember", createError);
    return { error: de.admin.managedCreateError };
  }
  const newUserId = created.user.id;

  // Mark the profile managed (the trigger created it without the flag).
  const { error: flagError } = await service
    .from("profile")
    .update({ managed: true })
    .eq("user_id", newUserId);
  if (flagError) {
    logActionError("createManagedMember.flag", flagError);
    await service.auth.admin.deleteUser(newUserId);
    return { error: de.admin.managedCreateError };
  }

  const { error: memberError } = await service
    .from("tenant_member")
    .insert({ tenant_id: parsed.data.tenantId, user_id: newUserId, role: "member" });
  if (memberError) {
    logActionError("createManagedMember.member", memberError);
    await service.auth.admin.deleteUser(newUserId);
    return { error: de.admin.managedCreateError };
  }

  await service.from("admin_audit_log").insert({
    tenant_id: parsed.data.tenantId,
    actor_id: actorId,
    action: "member_create_managed",
    target_type: "user",
    target_id: newUserId,
    detail: { display_name: parsed.data.displayName },
  });

  revalidatePath(`/${parsed.data.tenantId}/admin`);
  revalidatePath(`/${parsed.data.tenantId}/matches`);
  return { error: null, info: de.admin.managedCreated(parsed.data.displayName) };
}

const convertManagedSchema = tenantField.extend({
  targetUserId: z.string().uuid(),
  email: z.string().trim().email(),
});

/**
 * Upgrade a managed member to a real login account: assign the real email the
 * admin collected, clear the managed flag, and send a recovery link so the
 * person sets their own password and takes over their tip history (user_id is
 * stable, so all existing predictions/scores stay attached). Admin/site-admin
 * only; refuses non-managed targets so it can't hijack a real account's email.
 */
export async function convertManagedMemberAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = convertManagedSchema.safeParse({
    tenantId: formData.get("tenantId"),
    targetUserId: formData.get("targetUserId"),
    email: formData.get("email"),
  });
  if (!parsed.success) return { error: de.admin.managedConvertError };

  const supabase = await createClient();
  const actorId = await adminOrSiteAdminUserId(supabase, parsed.data.tenantId);
  if (!actorId) return { error: de.admin.managedConvertError };

  const service = createServiceClient();

  // Guard: only an actually-managed member of this tenant may be converted.
  const { data: member } = await service
    .from("tenant_member")
    .select("user_id")
    .eq("tenant_id", parsed.data.tenantId)
    .eq("user_id", parsed.data.targetUserId)
    .maybeSingle();
  if (!member) return { error: de.admin.managedConvertError };

  const { data: profile } = await service
    .from("profile")
    .select("managed")
    .eq("user_id", parsed.data.targetUserId)
    .maybeSingle();
  if (!profile?.managed) return { error: de.admin.managedConvertNotManaged };

  // Assign the real email (confirmed immediately — there is no old inbox to
  // verify against, the synthetic address is non-deliverable).
  const { error: updateError } = await service.auth.admin.updateUserById(parsed.data.targetUserId, {
    email: parsed.data.email,
    email_confirm: true,
  });
  if (updateError) {
    if (updateError.code === EMAIL_EXISTS) return { error: de.admin.managedConvertEmailTaken };
    logActionError("convertManagedMember.update", updateError);
    return { error: de.admin.managedConvertError };
  }

  const { error: flagError } = await service
    .from("profile")
    .update({ managed: false })
    .eq("user_id", parsed.data.targetUserId);
  if (flagError) {
    logActionError("convertManagedMember.flag", flagError);
    return { error: de.admin.managedConvertError };
  }

  // Send the branded recovery mail so the person sets a password and takes over.
  const { error: mailError } = await supabase.auth.resetPasswordForEmail(parsed.data.email);
  if (mailError) {
    // Email + flag are already updated; the admin can resend a reset manually.
    logActionError("convertManagedMember.mail", mailError);
    return { error: de.admin.managedConvertMailFailed };
  }

  await service.from("admin_audit_log").insert({
    tenant_id: parsed.data.tenantId,
    actor_id: actorId,
    action: "member_convert_managed",
    target_type: "user",
    target_id: parsed.data.targetUserId,
  });

  revalidatePath(`/${parsed.data.tenantId}/admin`);
  return { error: null, info: de.admin.managedConverted(parsed.data.email) };
}
