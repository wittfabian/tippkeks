"use client";

import { useActionState } from "react";

import { createGroupAction, joinGroupAction } from "@/actions/tenant";
import { initialActionState } from "@/actions/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { de } from "@/messages/de";

export function CreateGroupForm() {
  const [state, formAction, pending] = useActionState(createGroupAction, initialActionState);
  return (
    <form action={formAction} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="name">{de.groups.name}</Label>
        <Input id="name" name="name" required minLength={2} maxLength={80} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="slug">{de.groups.slug}</Label>
        <Input id="slug" name="slug" required pattern="[a-z0-9\-]+" placeholder="z-b-bueroliga" />
        <p className="text-muted-foreground text-xs">{de.groups.slugHint}</p>
      </div>
      {state.error && (
        <p role="alert" className="text-destructive text-sm">
          {state.error}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? de.common.loading : de.groups.createSubmit}
      </Button>
    </form>
  );
}

export function JoinGroupForm() {
  const [state, formAction, pending] = useActionState(joinGroupAction, initialActionState);
  return (
    <form action={formAction} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="code">{de.groups.code}</Label>
        <Input id="code" name="code" required autoComplete="off" className="uppercase" />
      </div>
      {state.error && (
        <p role="alert" className="text-destructive text-sm">
          {state.error}
        </p>
      )}
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? de.common.loading : de.groups.joinSubmit}
      </Button>
    </form>
  );
}
