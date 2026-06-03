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

export function NewPasswordForm() {
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

      <FormMessage error={state.error} />

      <SubmitButton label={de.auth.newPasswordSubmit} className="w-full" />
    </form>
  );
}
