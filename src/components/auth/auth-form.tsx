"use client";

import { useActionState, useState } from "react";

import { resendConfirmationAction, signInAction, signUpAction } from "@/actions/auth";
import { initialActionState } from "@/actions/types";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";
import { de } from "@/messages/de";

export function AuthForm({ mode, invite }: { mode: "login" | "register"; invite?: string }) {
  const action = mode === "login" ? signInAction : signUpAction;
  const [state, formAction] = useActionState(action, initialActionState);
  // Controlled so the "resend confirmation" form (a sibling, not nestable inside
  // this one) can reuse the address the user just typed.
  const [email, setEmail] = useState("");
  const [resendState, resendAction] = useActionState(resendConfirmationAction, initialActionState);

  return (
    <div className="space-y-4">
      <form action={formAction} className="space-y-4">
        {invite && <input type="hidden" name="invite" value={invite} />}
        {mode === "register" && (
          <div className="space-y-2">
            <Label htmlFor="displayName">{de.auth.displayName}</Label>
            <Input
              id="displayName"
              name="displayName"
              required
              maxLength={60}
              autoComplete="name"
            />
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="email">{de.auth.email}</Label>
          <Input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">{de.auth.password}</Label>
          <Input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
          />
          {mode === "register" && (
            <p className="text-muted-foreground text-xs">{de.auth.passwordHint}</p>
          )}
        </div>

        <FormMessage error={state.error} info={state.info} />

        <SubmitButton
          label={mode === "login" ? de.auth.signIn : de.auth.signUp}
          className="w-full"
        />
      </form>

      {mode === "login" && state.needsConfirmation && (
        <form action={resendAction} className="space-y-2">
          <input type="hidden" name="email" value={email} />
          <SubmitButton
            label={de.auth.resendConfirmation}
            variant="outline"
            className="w-full"
            disabled={!email}
          />
          <FormMessage info={resendState.info} />
        </form>
      )}
    </div>
  );
}
