"use client";

import { useActionState } from "react";

import { requestPasswordResetAction } from "@/actions/auth";
import { initialActionState } from "@/actions/types";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";
import { de } from "@/messages/de";

export function ResetRequestForm() {
  const [state, formAction] = useActionState(requestPasswordResetAction, initialActionState);
  const sent = Boolean(state.info);

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">{de.auth.email}</Label>
        <Input id="email" name="email" type="email" required autoComplete="email" disabled={sent} />
      </div>

      <FormMessage info={state.info} />

      {!sent && <SubmitButton label={de.auth.resetSubmit} className="w-full" />}
    </form>
  );
}
