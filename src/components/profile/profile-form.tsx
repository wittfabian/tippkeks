"use client";

import { useActionState } from "react";

import {
  deleteAccountAction,
  updateDisplayNameAction,
  updateEmailAction,
  updatePasswordAction,
} from "@/actions/profile";
import { initialActionState } from "@/actions/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { de } from "@/messages/de";

function Message({ error, info }: { error: string | null; info?: string | null }) {
  if (error)
    return (
      <p role="alert" className="text-destructive text-sm">
        {error}
      </p>
    );
  if (info)
    return (
      <p role="status" className="text-sm text-emerald-600">
        {info}
      </p>
    );
  return null;
}

export function DisplayNameForm({ displayName }: { displayName: string }) {
  const [state, formAction, pending] = useActionState(updateDisplayNameAction, initialActionState);
  return (
    <form action={formAction} className="space-y-3">
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
      <Message error={state.error} info={state.info} />
      <Button type="submit" disabled={pending}>
        {pending ? de.common.loading : de.profile.save}
      </Button>
    </form>
  );
}

export function EmailForm({ email }: { email: string }) {
  const [state, formAction, pending] = useActionState(updateEmailAction, initialActionState);
  return (
    <form action={formAction} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="email">{de.profile.email}</Label>
        <Input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          defaultValue={email}
        />
      </div>
      <Message error={state.error} info={state.info} />
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? de.common.loading : de.profile.emailSave}
      </Button>
    </form>
  );
}

export function PasswordForm() {
  const [state, formAction, pending] = useActionState(updatePasswordAction, initialActionState);
  return (
    <form action={formAction} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="currentPassword">{de.profile.currentPassword}</Label>
        <Input
          id="currentPassword"
          name="currentPassword"
          type="password"
          required
          autoComplete="current-password"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="newPassword">{de.profile.newPassword}</Label>
        <Input
          id="newPassword"
          name="newPassword"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
        />
        <p className="text-muted-foreground text-xs">{de.profile.passwordHint}</p>
      </div>
      <Message error={state.error} info={state.info} />
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? de.common.loading : de.profile.passwordSave}
      </Button>
    </form>
  );
}

export function DeleteAccountForm() {
  const [state, formAction, pending] = useActionState(deleteAccountAction, initialActionState);
  return (
    <form action={formAction} className="space-y-3">
      <p className="text-muted-foreground text-sm">{de.profile.dangerHint}</p>
      <div className="space-y-1.5">
        <Label htmlFor="deletePassword">{de.profile.deleteConfirmLabel}</Label>
        <Input
          id="deletePassword"
          name="currentPassword"
          type="password"
          required
          autoComplete="current-password"
          className="max-w-sm"
        />
      </div>
      <Message error={state.error} info={state.info} />
      <Button type="submit" variant="destructive" disabled={pending}>
        {pending ? de.common.loading : de.profile.deleteSubmit}
      </Button>
    </form>
  );
}
