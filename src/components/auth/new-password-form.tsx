"use client";

import Link from "next/link";
import { useActionState } from "react";

import { setNewPasswordAction } from "@/actions/auth";
import { initialActionState } from "@/actions/types";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { de } from "@/messages/de";

export function NewPasswordForm() {
  const [state, formAction, pending] = useActionState(setNewPasswordAction, initialActionState);

  // On success the recovery session is still valid, so send the user straight
  // into the app rather than back through the login form.
  if (state.info) {
    return (
      <div className="space-y-4">
        <p role="status" className="text-sm text-emerald-600">
          {state.info}
        </p>
        <Link href="/gruppen" className={buttonVariants({ className: "w-full" })}>
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

      {state.error && (
        <p role="alert" className="text-destructive text-sm">
          {state.error}
        </p>
      )}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? de.common.loading : de.auth.newPasswordSubmit}
      </Button>
    </form>
  );
}
