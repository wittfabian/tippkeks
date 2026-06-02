"use client";

import { useActionState, useState } from "react";

import { resendConfirmationAction, signInAction, signUpAction } from "@/actions/auth";
import { initialActionState } from "@/actions/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { de } from "@/messages/de";

export function AuthForm({ mode, invite }: { mode: "login" | "register"; invite?: string }) {
  const action = mode === "login" ? signInAction : signUpAction;
  const [state, formAction, pending] = useActionState(action, initialActionState);
  // Controlled so the "resend confirmation" form (a sibling, not nestable inside
  // this one) can reuse the address the user just typed.
  const [email, setEmail] = useState("");
  const [resendState, resendAction, resendPending] = useActionState(
    resendConfirmationAction,
    initialActionState,
  );

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

        {state.error && (
          <p role="alert" className="text-destructive text-sm">
            {state.error}
          </p>
        )}
        {state.info && (
          <p role="status" className="text-sm text-emerald-600">
            {state.info}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? de.common.loading : mode === "login" ? de.auth.signIn : de.auth.signUp}
        </Button>
      </form>

      {mode === "login" && state.needsConfirmation && (
        <form action={resendAction} className="space-y-2">
          <input type="hidden" name="email" value={email} />
          <Button
            type="submit"
            variant="outline"
            className="w-full"
            disabled={resendPending || !email}
          >
            {resendPending ? de.common.loading : de.auth.resendConfirmation}
          </Button>
          {resendState.info && (
            <p role="status" className="text-sm text-emerald-600">
              {resendState.info}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
