"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { rateLimit } from "@/lib/cache/rate-limit";
import { getAppSettings } from "@/lib/data/settings";
import { serverEnv } from "@/lib/env.server";
import { createClient } from "@/lib/supabase/server";
import { de } from "@/messages/de";
import { logActionError, type ActionState } from "@/actions/types";

/** Best-effort client IP from proxy headers (Hetzner/LB sets X-Forwarded-For). */
async function getClientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || h.get("x-real-ip") || "unknown";
}

/**
 * Public origin for building the email-confirmation redirect link. Mirrors the
 * resolution in /auth/confirm: prefer the configured SITE_URL, then the proxy's
 * forwarded host/proto, and fall back to local dev. The just-built URL is handed
 * to GoTrue as `emailRedirectTo`, so it must be on the Supabase redirect allow-list.
 */
async function resolveOrigin(): Promise<string> {
  if (serverEnv.SITE_URL) return serverEnv.SITE_URL;
  // In production SITE_URL is mandatory: never build auth-mail links from the
  // attacker-controllable Host / X-Forwarded-Host header (host-header injection).
  if (process.env.NODE_ENV === "production") {
    throw new Error("SITE_URL must be set in production to build auth redirect links");
  }
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("x-forwarded-host") ?? h.get("host");
  return host ? `${proto}://${host}` : "http://127.0.0.1:3000";
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
  if (error) {
    // An unconfirmed account returns a specific code; show the "confirm your
    // email" hint instead of the misleading "wrong credentials". This leaks no
    // new information — the register flow already reveals existence ("email
    // taken"), and the password was, in fact, correct here.
    if (error.code === "email_not_confirmed" || /not confirmed/i.test(error.message)) {
      return { error: null, info: de.auth.checkEmail, needsConfirmation: true };
    }
    return { error: de.auth.errorInvalid };
  }

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

const resendSchema = z.object({ email: z.string().trim().email() });

/**
 * Resend the sign-up confirmation email. Offered on the login form when an
 * unconfirmed account tries to sign in. Throttled per IP and per address to
 * prevent inbox-bombing, and always returns the same confirmation regardless of
 * outcome (already confirmed / unknown address) so it can't probe account state.
 */
export async function resendConfirmationAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = resendSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { error: de.auth.errorInvalid };

  const email = parsed.data.email.toLowerCase();
  const [byIp, byEmail] = await Promise.all([
    rateLimit(`confirm:ip:${await getClientIp()}`, 5, 900),
    rateLimit(`confirm:email:${email}`, 3, 3600),
  ]);
  if (byIp.allowed && byEmail.allowed) {
    const supabase = await createClient();
    // Swallow errors (already confirmed / unknown address): always answer the
    // same so this can't be used to probe which accounts exist or are confirmed.
    await supabase.auth.resend({ type: "signup", email });
  }
  return { error: null, info: de.auth.confirmationResent };
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

  // Throttle per IP to prevent mass account creation / confirmation-mail spam
  // (defense in depth — Supabase/GoTrue also rate-limits).
  const { allowed } = await rateLimit(`signup:ip:${await getClientIp()}`, 10, 900);
  if (!allowed) return { error: de.auth.tooManyRequests };

  const supabase = await createClient();

  // Re-check the global toggle server-side — the trust boundary, not the page.
  const { registrationEnabled } = await getAppSettings(supabase);
  if (!registrationEnabled) return { error: de.auth.registrationClosed };

  // A signup begun from a shared invite link must survive the email-confirmation
  // round-trip (production): there is no session yet, so the code can't be redeemed
  // here. Carry it as the confirmation link's redirect target (/join/<code>) — once
  // /auth/confirm verifies the OTP and establishes the session, it redeems the invite
  // and lands the user straight in the group. Without confirmation (local dev) the
  // session exists immediately and postAuthDestination below redeems it.
  const rawInvite = formData.get("invite");
  const inviteCode = typeof rawInvite === "string" ? rawInvite.trim().toUpperCase() : "";
  const emailRedirectTo = inviteCode
    ? `${await resolveOrigin()}/join/${encodeURIComponent(inviteCode)}`
    : undefined;

  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { display_name: parsed.data.displayName }, emailRedirectTo },
  });
  if (error) {
    const taken = /registered|exists/i.test(error.message);
    // Surface the real GoTrue reason server-side — the UI message is deliberately
    // generic, but "Error sending confirmation email" / "Database error saving new
    // user" / "Signups not allowed" must be diagnosable from the logs.
    if (!taken) logActionError("signUp", error);
    return { error: taken ? de.auth.errorTaken : de.auth.errorGeneric };
  }

  // When email confirmation is enabled (production) there is no session yet.
  if (!data.session) return { error: null, info: de.auth.checkEmail };

  redirect(await postAuthDestination(supabase, rawInvite));
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

const newPasswordSchema = z.object({
  password: z.string().min(8),
  // The recovery link now carries its single-use OTP to this form (see the
  // recovery email template) instead of spending it on the prefetchable
  // /auth/confirm GET. Absent for the legacy path where /auth/confirm already
  // established the session.
  tokenHash: z.string().min(1).optional(),
});

/**
 * Set a new password during recovery. Possession of the emailed token is the
 * proof (no current-password reauth). The token is verified HERE, on submit — a
 * POST that email link-scanners and browser prefetchers don't trigger — so a
 * scanned link no longer spends the single-use token before the user clicks.
 * verifyOtp establishes the session; updateUser then sets the password. The
 * legacy path (session already set by /auth/confirm, no tokenHash) still works.
 * The (reset) layout, unlike (public), does not bounce the signed-in user away.
 */
export async function setNewPasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = newPasswordSchema.safeParse({
    password: formData.get("password"),
    tokenHash: formData.get("token_hash") ?? undefined,
  });
  if (!parsed.success) {
    // A bad/expired token_hash never reaches Zod (it accepts any non-empty
    // string); only a too-short password does, so this is the password hint.
    return { error: de.auth.passwordHint };
  }

  const supabase = await createClient();

  if (parsed.data.tokenHash) {
    const { error } = await supabase.auth.verifyOtp({
      type: "recovery",
      token_hash: parsed.data.tokenHash,
    });
    // Spent or expired link — same message as the page's no-session state.
    if (error) return { error: de.auth.newPasswordNoSession };
  }

  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) return { error: de.auth.newPasswordNoSession };

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    logActionError("setNewPassword", error);
    return { error: de.auth.newPasswordError };
  }

  return { error: null, info: de.auth.newPasswordSaved };
}
