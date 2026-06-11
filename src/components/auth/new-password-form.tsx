"use client";

import Link from "next/link";
import { useActionState } from "react";

import { setNewPasswordAction } from "@/actions/auth";
import { initialActionState } from "@/actions/types";
import { buttonVariants } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";
import { de } from "@/messages/de";

export function NewPasswordForm({ tokenHash }: { tokenHash: string | null }) {
  const [state, formAction] = useActionState(setNewPasswordAction, initialActionState);

  // On success the recovery session is still valid, so send the user straight
  // into the app rather than back through the login form.
  if (state.info) {
    return (
      <div className="space-y-4">
        <FormMessage info={state.info} />
        <Link href="/groups" className={buttonVariants({ className: "w-full" })}>
          {de.auth.newPasswordContinue}
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      {/* The recovery OTP, carried from the email link and spent server-side on
          submit (not on the prefetchable page load). */}
      {tokenHash ? <input type="hidden" name="token_hash" value={tokenHash} /> : null}

      {/* The MFA step-up needs a second submit (recovery sessions are aal1; a
          password change needs aal2). React re-runs this route's server component
          after the first submit, which remounts the form and clears the field, so
          the new password is entered again alongside the code — see the hint. */}
      {state.needsMfa ? (
        <p className="text-muted-foreground text-sm">{de.auth.newPasswordMfaIntro}</p>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="password">{de.auth.newPassword}</Label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
        />
        <p className="text-muted-foreground text-xs">{de.auth.passwordHint}</p>
      </div>

      {state.needsMfa ? (
        <div className="space-y-2">
          {/* The factor to challenge, returned by the first submit — a cookie-only
              session on this second submit can't rediscover it. */}
          {state.mfaFactorId ? (
            <input type="hidden" name="mfaFactorId" value={state.mfaFactorId} />
          ) : null}
          <Label htmlFor="mfaCode">{de.auth.mfaCodeLabel}</Label>
          <Input
            id="mfaCode"
            name="mfaCode"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            maxLength={6}
            className="text-center text-lg tracking-[0.4em] tabular-nums"
          />
          <p className="text-muted-foreground text-xs">{de.auth.mfaPrompt}</p>
        </div>
      ) : null}

      <FormMessage error={state.error} />

      <SubmitButton label={de.auth.newPasswordSubmit} className="w-full" />
    </form>
  );
}
