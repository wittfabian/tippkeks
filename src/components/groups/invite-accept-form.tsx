"use client";

import { useActionState } from "react";

import { joinGroupAction } from "@/actions/tenant";
import { initialActionState } from "@/actions/types";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { de } from "@/messages/de";

/**
 * One-click accept for a shared invite link, used on /join/[code] once the
 * visitor is authenticated. Reuses joinGroupAction (redeem_invite) with the code
 * carried in a hidden field; on success the action redirects into the group.
 */
export function InviteAcceptForm({ code }: { code: string }) {
  const [state, formAction] = useActionState(joinGroupAction, initialActionState);
  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="code" value={code} />
      <SubmitButton label={de.invite.accept} className="w-full" />
      {/* Any redeem failure means the link is invalid/expired/used up. */}
      <FormMessage error={state.error ? de.invite.invalidBody : null} />
    </form>
  );
}
