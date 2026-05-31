"use client";

import { useActionState } from "react";

import { updateProfileAction } from "@/actions/profile";
import { initialActionState } from "@/actions/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { de } from "@/messages/de";

export function ProfileForm({ slug, displayName }: { slug: string; displayName: string }) {
  const [state, formAction, pending] = useActionState(updateProfileAction, initialActionState);
  return (
    <form action={formAction} className="max-w-sm space-y-3">
      <input type="hidden" name="slug" value={slug} />
      <div className="space-y-1.5">
        <Label htmlFor="displayName">{de.profile.displayName}</Label>
        <Input
          id="displayName"
          name="displayName"
          required
          minLength={1}
          maxLength={60}
          defaultValue={displayName}
        />
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
      <Button type="submit" disabled={pending}>
        {pending ? de.common.loading : de.profile.save}
      </Button>
    </form>
  );
}
