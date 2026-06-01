"use client";

import { useActionState } from "react";

import { requestPasswordResetAction } from "@/actions/auth";
import { initialActionState } from "@/actions/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { de } from "@/messages/de";

export function ResetRequestForm() {
  const [state, formAction, pending] = useActionState(
    requestPasswordResetAction,
    initialActionState,
  );
  const sent = Boolean(state.info);

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">{de.auth.email}</Label>
        <Input id="email" name="email" type="email" required autoComplete="email" disabled={sent} />
      </div>

      {state.info && (
        <p role="status" className="text-sm text-emerald-600">
          {state.info}
        </p>
      )}

      {!sent && (
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? de.common.loading : de.auth.resetSubmit}
        </Button>
      )}
    </form>
  );
}
