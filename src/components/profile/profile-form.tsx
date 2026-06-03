"use client";

import { useActionState } from "react";

import {
  deleteAccountAction,
  updateDisplayNameAction,
  updateEmailAction,
  updatePasswordAction,
} from "@/actions/profile";
import { initialActionState } from "@/actions/types";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";
import { de } from "@/messages/de";

export function DisplayNameForm({ displayName }: { displayName: string }) {
  const [state, formAction] = useActionState(updateDisplayNameAction, initialActionState);
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
      <FormMessage error={state.error} info={state.info} />
      <SubmitButton label={de.profile.save} />
    </form>
  );
}

export function EmailForm({ email }: { email: string }) {
  const [state, formAction] = useActionState(updateEmailAction, initialActionState);
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
      <FormMessage error={state.error} info={state.info} />
      <SubmitButton label={de.profile.emailSave} variant="secondary" />
    </form>
  );
}

export function PasswordForm() {
  const [state, formAction] = useActionState(updatePasswordAction, initialActionState);
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
      <FormMessage error={state.error} info={state.info} />
      <SubmitButton label={de.profile.passwordSave} variant="secondary" />
    </form>
  );
}

export function DeleteAccountForm() {
  const [state, formAction] = useActionState(deleteAccountAction, initialActionState);
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
      <FormMessage error={state.error} info={state.info} />
      <SubmitButton label={de.profile.deleteSubmit} variant="destructive" />
    </form>
  );
}
