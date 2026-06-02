"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { rateLimit } from "@/lib/cache/rate-limit";
import { getAppSettings } from "@/lib/data/settings";
import { createClient } from "@/lib/supabase/server";
import { de } from "@/messages/de";
import { logActionError, type ActionState } from "@/actions/types";

/** Best-effort client IP from proxy headers (Hetzner/LB sets X-Forwarded-For). */
async function getClientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || h.get("x-real-ip") || "unknown";
}

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const registrationSchema = credentialsSchema.extend({
  displayName: z.string().trim().min(1).max(60),
});

/**
 * Where to send the user after authentication. With a valid invite code present
 * (from a shared join link), redeem it on the just-authenticated session client
 * and land them straight in that group; otherwise the group chooser. Redemption
 * failure is non-fatal — a bad/expired code must never block a valid login.
 */
async function postAuthDestination(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rawInvite: FormDataEntryValue | null,
): Promise<string> {
  const code = typeof rawInvite === "string" ? rawInvite.trim().toUpperCase() : "";
  if (!code) return "/groups";
  const { data } = await supabase.rpc("redeem_invite", { p_code: code });
  return data?.id ? `/${data.id}` : "/groups";
}

export async function signInAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: de.auth.errorInvalid };

  // Throttle credential stuffing per IP (defense in depth — Supabase also limits).
  const { allowed } = await rateLimit(`signin:ip:${await getClientIp()}`, 20, 300);
  if (!allowed) return { error: de.auth.tooManyRequests };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: de.auth.errorInvalid };

  // If the account has a verified second factor, sign-in only reaches aal1 —
  // send them to the /mfa challenge before resolving their destination. The
  // (app) layout enforces the same gate for any other entry point. The invite,
  // if any, is redeemed after the challenge (not here) so it is not consumed
  // while MFA is still pending.
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel === "aal1" && aal.nextLevel === "aal2") {
    const invite = formData.get("invite");
    const params = new URLSearchParams();
    if (typeof invite === "string" && invite.trim()) params.set("invite", invite.trim());
    const qs = params.toString();
    redirect(qs ? `/mfa?${qs}` : "/mfa");
  }

  redirect(await postAuthDestination(supabase, formData.get("invite")));
}

export async function signUpAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = registrationSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    displayName: formData.get("displayName"),
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: issue?.path[0] === "password" ? de.auth.passwordHint : de.auth.errorGeneric };
  }

  const supabase = await createClient();

  // Re-check the global toggle server-side — the trust boundary, not the page.
  const { registrationEnabled } = await getAppSettings(supabase);
  if (!registrationEnabled) return { error: de.auth.registrationClosed };

  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { display_name: parsed.data.displayName } },
  });
  if (error) {
    return {
      error: /registered|exists/i.test(error.message) ? de.auth.errorTaken : de.auth.errorGeneric,
    };
  }

  // When email confirmation is enabled (production) there is no session yet.
  if (!data.session) return { error: null, info: de.auth.checkEmail };

  redirect(await postAuthDestination(supabase, formData.get("invite")));
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

const resetRequestSchema = z.object({ email: z.string().trim().email() });

/**
 * Send a password-recovery email. Supabase builds the link from its recovery
 * template (→ /auth/confirm?type=recovery&next=/reset-password). We always return
 * the same confirmation regardless of outcome so the form can't be used to probe
 * which email addresses have an account (enumeration protection).
 */
export async function requestPasswordResetAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = resetRequestSchema.safeParse({ email: formData.get("email") });
  if (parsed.success) {
    // Throttle recovery emails per IP and per address to prevent inbox-bombing.
    // On limit we silently skip the send but still return the same message, so
    // the limiter can't be used to probe which emails exist.
    const email = parsed.data.email.toLowerCase();
    const [byIp, byEmail] = await Promise.all([
      rateLimit(`pwreset:ip:${await getClientIp()}`, 5, 900),
      rateLimit(`pwreset:email:${email}`, 3, 3600),
    ]);
    if (byIp.allowed && byEmail.allowed) {
      const supabase = await createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email);
      if (error) logActionError("requestPasswordReset", error);
    }
  }
  return { error: null, info: de.auth.resetSent };
}

const newPasswordSchema = z.object({ password: z.string().min(8) });

/**
 * Set a new password during recovery. The recovery link established a session
 * via /auth/confirm; without it we refuse (no current-password reauth is needed
 * — possession of the emailed token is the proof). The (reset) layout, unlike
 * (public), does not bounce the now-signed-in user away before this runs.
 */
export async function setNewPasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = newPasswordSchema.safeParse({ password: formData.get("password") });
  if (!parsed.success) return { error: de.auth.passwordHint };

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) return { error: de.auth.newPasswordNoSession };

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    logActionError("setNewPassword", error);
    return { error: de.auth.newPasswordError };
  }

  return { error: null, info: de.auth.newPasswordSaved };
}
