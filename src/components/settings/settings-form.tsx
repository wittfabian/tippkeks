"use client";

import { useActionState } from "react";

import { updateAppSettingsAction } from "@/actions/settings";
import { initialActionState } from "@/actions/types";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { ToggleRow } from "@/components/ui/toggle-row";
import { de } from "@/messages/de";

export function SettingsForm({
  registrationEnabled,
  groupCreationEnabled,
}: {
  registrationEnabled: boolean;
  groupCreationEnabled: boolean;
}) {
  const [state, formAction] = useActionState(updateAppSettingsAction, initialActionState);

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
      <FormMessage error={state.error} info={state.info} />
      <SubmitButton label={de.settings.save} />
    </form>
  );
}
