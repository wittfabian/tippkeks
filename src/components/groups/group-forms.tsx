"use client";

import { useActionState } from "react";

import { createGroupAction, joinGroupAction } from "@/actions/tenant";
import { initialActionState } from "@/actions/types";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";
import { de } from "@/messages/de";

export function CreateGroupForm() {
  const [state, formAction] = useActionState(createGroupAction, initialActionState);
  return (
    <form action={formAction} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="name">{de.groups.name}</Label>
        <Input id="name" name="name" required minLength={2} maxLength={80} />
      </div>
      <FormMessage error={state.error} />
      <SubmitButton label={de.groups.createSubmit} />
    </form>
  );
}

export function JoinGroupForm() {
  const [state, formAction] = useActionState(joinGroupAction, initialActionState);
  return (
    <form action={formAction} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="code">{de.groups.code}</Label>
        <Input id="code" name="code" required autoComplete="off" className="uppercase" />
      </div>
      <FormMessage error={state.error} />
      <SubmitButton label={de.groups.joinSubmit} variant="secondary" />
    </form>
  );
}
