"use client";

import { useActionState } from "react";

import { joinGroupAction } from "@/actions/tenant";
import { initialActionState } from "@/actions/types";
import { Button } from "@/components/ui/button";
import { de } from "@/messages/de";

/**
 * One-click accept for a shared invite link, used on /beitreten/[code] once the
 * visitor is authenticated. Reuses joinGroupAction (redeem_invite) with the code
 * carried in a hidden field; on success the action redirects into the group.
 */
export function InviteAcceptForm({ code }: { code: string }) {
  const [state, formAction, pending] = useActionState(joinGroupAction, initialActionState);
  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="code" value={code} />
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? de.common.loading : de.invite.accept}
      </Button>
      {state.error && (
        <p role="alert" className="text-destructive text-sm">
          {de.invite.invalidBody}
        </p>
      )}
    </form>
  );
}
