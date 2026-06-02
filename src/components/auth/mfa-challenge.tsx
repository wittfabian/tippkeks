"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { signOutAction } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { de } from "@/messages/de";

/**
 * Verifies the user's TOTP second factor to raise the session to aal2. On
 * success it redeems any pending invite (deferred from sign-in) and navigates
 * to the resolved destination.
 */
export function MfaChallenge({ invite, redirectTo }: { invite?: string; redirectTo?: string }) {
  const router = useRouter();
  const [factorId, setFactorId] = useState<string | null>(null);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const finish = useCallback(async () => {
    const supabase = createClient();
    // Same-origin paths only: a protocol-relative "//evil.com" also starts with
    // "/", so reject it explicitly to avoid an open redirect off-site.
    let destination =
      redirectTo && redirectTo.startsWith("/") && !redirectTo.startsWith("//")
        ? redirectTo
        : "/gruppen";
    const code = invite?.trim().toUpperCase();
    if (code) {
      const { data } = await supabase.rpc("redeem_invite", { p_code: code });
      if (data?.id) destination = `/${data.id}`;
    }
    router.replace(destination);
    router.refresh();
  }, [invite, redirectTo, router]);

  // On mount: if already aal2 just continue; otherwise open a challenge against
  // the verified TOTP factor.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal?.currentLevel === "aal2") {
        await finish();
        return;
      }
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const totp = (factors?.all ?? []).find(
        (f) => f.factor_type === "totp" && f.status === "verified",
      );
      if (!totp) {
        // No factor after all — nothing to challenge; carry on.
        await finish();
        return;
      }
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: totp.id,
      });
      if (cancelled) return;
      if (challengeError || !challenge) {
        setError(de.auth.mfaError);
        setReady(true);
        return;
      }
      setFactorId(totp.id);
      setChallengeId(challenge.id);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [finish]);

  async function submit() {
    if (!factorId || !challengeId) return;
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId,
      code: code.trim(),
    });
    if (verifyError) {
      // The challenge is consumed on a failed verify — open a fresh one so the
      // next code attempt can succeed.
      const { data: challenge } = await supabase.auth.mfa.challenge({ factorId });
      setChallengeId(challenge?.id ?? null);
      setCode("");
      setError(de.auth.mfaCodeError);
      setBusy(false);
      return;
    }
    await finish();
  }

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">{de.auth.mfaPrompt}</p>
      <div className="space-y-1.5">
        <Label htmlFor="mfaCode">{de.auth.mfaCodeLabel}</Label>
        <Input
          id="mfaCode"
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          maxLength={6}
          value={code}
          disabled={!ready}
          onChange={(e) => setCode(e.target.value)}
          className="text-center text-lg tracking-[0.4em] tabular-nums"
        />
      </div>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      <Button
        type="button"
        className="w-full"
        onClick={submit}
        disabled={busy || !ready || code.length < 6}
      >
        {busy ? de.common.loading : de.auth.mfaSubmit}
      </Button>
      <form action={signOutAction}>
        <Button type="submit" variant="ghost" size="sm" className="w-full">
          {de.auth.mfaCancel}
        </Button>
      </form>
    </div>
  );
}
