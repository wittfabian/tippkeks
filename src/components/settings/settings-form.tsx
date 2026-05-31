"use client";

import { useActionState } from "react";

import { updateAppSettingsAction } from "@/actions/settings";
import { initialActionState } from "@/actions/types";
import { Button } from "@/components/ui/button";
import { de } from "@/messages/de";

function ToggleRow({
  name,
  label,
  hint,
  defaultChecked,
}: {
  name: string;
  label: string;
  hint: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="accent-primary mt-0.5 size-4 cursor-pointer"
      />
      <span className="space-y-0.5">
        <span className="block text-sm font-medium">{label}</span>
        <span className="text-muted-foreground block text-xs">{hint}</span>
      </span>
    </label>
  );
}

export function SettingsForm({
  registrationEnabled,
  groupCreationEnabled,
}: {
  registrationEnabled: boolean;
  groupCreationEnabled: boolean;
}) {
  const [state, formAction, pending] = useActionState(updateAppSettingsAction, initialActionState);

  return (
    <form action={formAction} className="space-y-4">
      <ToggleRow
        name="registrationEnabled"
        label={de.settings.registration}
        hint={de.settings.registrationHint}
        defaultChecked={registrationEnabled}
      />
      <ToggleRow
        name="groupCreationEnabled"
        label={de.settings.groupCreation}
        hint={de.settings.groupCreationHint}
        defaultChecked={groupCreationEnabled}
      />
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
        {pending ? de.common.loading : de.settings.save}
      </Button>
    </form>
  );
}
