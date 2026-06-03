"use client";

import { Info } from "lucide-react";
import { useActionState, type ReactNode } from "react";

import {
  convertManagedMemberAction,
  createInviteAction,
  createManagedMemberAction,
  deleteInviteAction,
  removeMemberAction,
  saveMemberTipsAction,
  saveScoringAction,
  setMemberRoleAction,
  setMemberTippingAction,
} from "@/actions/admin";
import { deleteGroupAction } from "@/actions/tenant";
import { initialActionState } from "@/actions/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { de } from "@/messages/de";

function Message({ error, info }: { error: string | null; info?: string | null }) {
  if (error)
    return (
      <p role="alert" className="text-destructive text-xs">
        {error}
      </p>
    );
  if (info)
    return (
      <p role="status" className="text-xs text-emerald-600">
        {info}
      </p>
    );
  return null;
}

export function CreateInviteForm({ tenantId }: { tenantId: string }) {
  const [state, formAction, pending] = useActionState(createInviteAction, initialActionState);
  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="tenantId" value={tenantId} />
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="maxUses">{de.admin.inviteMaxUses}</Label>
          <Input
            id="maxUses"
            name="maxUses"
            type="number"
            min={1}
            max={100000}
            placeholder={de.admin.inviteUnlimited}
            className="w-40"
          />
        </div>
        <label className="text-muted-foreground flex h-8 cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" name="asAdmin" className="accent-primary size-4 cursor-pointer" />
          {de.admin.inviteAsAdmin}
        </label>
      </div>
      <p className="text-muted-foreground text-xs">{de.admin.inviteMaxUsesHint}</p>
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? de.common.loading : de.admin.createInvite}
      </Button>
      <Message error={state.error} info={state.info} />
    </form>
  );
}

export function DeleteInviteButton({ tenantId, code }: { tenantId: string; code: string }) {
  const [state, formAction, pending] = useActionState(deleteInviteAction, initialActionState);
  return (
    <form action={formAction} className="inline-flex flex-col items-end gap-0.5">
      <input type="hidden" name="tenantId" value={tenantId} />
      <input type="hidden" name="code" value={code} />
      <Button type="submit" size="xs" variant="ghost" disabled={pending}>
        {de.admin.inviteDelete}
      </Button>
      {state.error && (
        <span role="alert" className="text-destructive text-xs">
          {state.error}
        </span>
      )}
    </form>
  );
}

export function CreateManagedMemberForm({ tenantId }: { tenantId: string }) {
  const [state, formAction, pending] = useActionState(
    createManagedMemberAction,
    initialActionState,
  );
  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="tenantId" value={tenantId} />
      <Label htmlFor="displayName" className="text-sm font-medium">
        {de.admin.managedCreateTitle}
      </Label>
      <p className="text-muted-foreground text-xs">{de.admin.managedCreateHint}</p>
      <div className="flex gap-2">
        <Input
          id="displayName"
          name="displayName"
          required
          minLength={1}
          maxLength={80}
          placeholder={de.admin.managedNamePlaceholder}
          className="max-w-xs"
        />
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? de.common.loading : de.admin.managedCreate}
        </Button>
      </div>
      <Message error={state.error} info={state.info} />
    </form>
  );
}

export function ConvertMemberForm({
  tenantId,
  targetUserId,
}: {
  tenantId: string;
  targetUserId: string;
}) {
  const [state, formAction, pending] = useActionState(
    convertManagedMemberAction,
    initialActionState,
  );
  return (
    <details className="mt-2 border-t pt-2">
      <summary className="text-primary cursor-pointer text-xs">{de.admin.managedConvert}</summary>
      <form action={formAction} className="mt-2 space-y-2">
        <input type="hidden" name="tenantId" value={tenantId} />
        <input type="hidden" name="targetUserId" value={targetUserId} />
        <p className="text-muted-foreground text-xs">{de.admin.managedConvertHint}</p>
        <div className="flex gap-2">
          <Input
            name="email"
            type="email"
            required
            placeholder={de.admin.managedConvertEmailPlaceholder}
            aria-label={de.admin.managedConvertEmailPlaceholder}
            className="max-w-xs"
          />
          <Button type="submit" size="sm" variant="secondary" disabled={pending}>
            {pending ? de.common.loading : de.admin.managedConvertSubmit}
          </Button>
        </div>
        <Message error={state.error} info={state.info} />
      </form>
    </details>
  );
}

export function MemberRowActions({
  tenantId,
  targetUserId,
  role,
}: {
  tenantId: string;
  targetUserId: string;
  role: "admin" | "member";
}) {
  const [roleState, roleAction, rolePending] = useActionState(
    setMemberRoleAction,
    initialActionState,
  );
  const [removeState, removeAction, removePending] = useActionState(
    removeMemberAction,
    initialActionState,
  );
  const nextRole = role === "admin" ? "member" : "admin";

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <form action={roleAction}>
          <input type="hidden" name="tenantId" value={tenantId} />
          <input type="hidden" name="targetUserId" value={targetUserId} />
          <input type="hidden" name="role" value={nextRole} />
          <Button type="submit" size="sm" variant="outline" disabled={rolePending}>
            {nextRole === "admin" ? de.admin.makeAdmin : de.admin.makeMember}
          </Button>
        </form>
        <form action={removeAction}>
          <input type="hidden" name="tenantId" value={tenantId} />
          <input type="hidden" name="targetUserId" value={targetUserId} />
          <Button type="submit" size="sm" variant="ghost" disabled={removePending}>
            {de.admin.remove}
          </Button>
        </form>
      </div>
      <Message error={roleState.error ?? removeState.error} />
    </div>
  );
}

export function MemberTippingForm({ tenantId, enabled }: { tenantId: string; enabled: boolean }) {
  const [state, formAction, pending] = useActionState(setMemberTippingAction, initialActionState);
  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="tenantId" value={tenantId} />
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          name="enabled"
          defaultChecked={enabled}
          className="accent-primary mt-0.5 size-4 cursor-pointer"
        />
        <span className="space-y-0.5">
          <span className="block text-sm font-medium">{de.admin.memberTipping}</span>
          <span className="text-muted-foreground block text-xs">{de.admin.memberTippingHint}</span>
        </span>
      </label>
      <Message error={state.error} info={state.info} />
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? de.common.loading : de.common.save}
      </Button>
    </form>
  );
}

export function DeleteGroupForm({ tenantId, groupName }: { tenantId: string; groupName: string }) {
  const [state, formAction, pending] = useActionState(deleteGroupAction, initialActionState);
  return (
    <form action={formAction} className="space-y-3">
      <p className="text-muted-foreground text-sm">{de.admin.deleteGroupHint}</p>
      <input type="hidden" name="tenantId" value={tenantId} />
      <div className="space-y-1.5">
        <Label htmlFor="confirmName">{de.admin.deleteGroupConfirmLabel}</Label>
        <Input
          id="confirmName"
          name="confirmName"
          required
          autoComplete="off"
          placeholder={groupName}
          className="max-w-sm"
        />
      </div>
      <Message error={state.error} info={state.info} />
      <Button type="submit" variant="destructive" disabled={pending}>
        {pending ? de.common.loading : de.admin.deleteGroupSubmit}
      </Button>
    </form>
  );
}

export interface MemberTipRow {
  userId: string;
  name: string;
  home: number | null;
  away: number | null;
}

export function MemberTipTable({
  tenantId,
  fixtureId,
  homeName,
  awayName,
  members,
  actions,
}: {
  tenantId: string;
  fixtureId: string;
  homeName: string;
  awayName: string;
  members: MemberTipRow[];
  /** Extra controls rendered next to the save button (e.g. the image download). */
  actions?: ReactNode;
}) {
  const [state, formAction, pending] = useActionState(saveMemberTipsAction, initialActionState);
  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="tenantId" value={tenantId} />
      <input type="hidden" name="fixtureId" value={fixtureId} />
      <input type="hidden" name="userIds" value={members.map((m) => m.userId).join(",")} />
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="text-muted-foreground border-b text-xs">
            <tr>
              <th className="px-3 py-2 text-left font-medium">{de.admin.members}</th>
              <th className="px-1 py-2 text-center font-medium">{homeName}</th>
              <th className="px-1 py-2" aria-hidden />
              <th className="px-1 py-2 text-center font-medium">{awayName}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {members.map((m) => (
              <tr key={m.userId}>
                <td className="max-w-40 truncate px-3 py-1.5">{m.name}</td>
                <td className="px-1 py-1.5 text-center">
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={99}
                    name={`home_${m.userId}`}
                    defaultValue={m.home ?? ""}
                    aria-label={`${m.name} ${homeName}`}
                    className="mx-auto w-14 text-center tabular-nums"
                  />
                </td>
                <td className="text-muted-foreground px-1 text-center" aria-hidden>
                  :
                </td>
                <td className="px-1 py-1.5 text-center">
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={99}
                    name={`away_${m.userId}`}
                    defaultValue={m.away ?? ""}
                    aria-label={`${m.name} ${awayName}`}
                    className="mx-auto w-14 text-center tabular-nums"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between gap-2">
        <Message error={state.error} info={state.info} />
        <div className="flex items-center gap-2">
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? de.common.loading : de.admin.tipsSave}
          </Button>
          {actions}
        </div>
      </div>
    </form>
  );
}

export interface ScoringValues {
  exact: number;
  goalDiff: number;
  tendency: number;
  advanceBonus: number;
}

export function ScoringForm({ tenantId, values }: { tenantId: string; values: ScoringValues }) {
  const [state, formAction, pending] = useActionState(saveScoringAction, initialActionState);
  const fields: { name: keyof ScoringValues; label: string; info: string }[] = [
    { name: "exact", label: de.admin.scoringExact, info: de.admin.scoringExactInfo },
    { name: "goalDiff", label: de.admin.scoringDiff, info: de.admin.scoringDiffInfo },
    { name: "tendency", label: de.admin.scoringTendency, info: de.admin.scoringTendencyInfo },
    { name: "advanceBonus", label: de.admin.scoringAdvance, info: de.admin.scoringAdvanceInfo },
  ];
  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="tenantId" value={tenantId} />
      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map((f) => (
          // Flex column with the input pinned to the bottom (mt-auto) so a label
          // that wraps to two lines does not push its input out of line with the
          // neighbouring cell's input in the same grid row.
          <div key={f.name} className="flex h-full flex-col gap-1.5">
            <div className="flex items-center gap-1.5">
              <Label htmlFor={f.name}>{f.label}</Label>
              <Popover>
                <PopoverTrigger
                  type="button"
                  aria-label={de.admin.scoringInfoAria}
                  className="text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex rounded-full focus-visible:ring-2 focus-visible:outline-none"
                >
                  <Info className="size-3.5" aria-hidden />
                </PopoverTrigger>
                <PopoverContent>{f.info}</PopoverContent>
              </Popover>
            </div>
            <Input
              id={f.name}
              name={f.name}
              type="number"
              min={0}
              max={100}
              required
              defaultValue={values[f.name]}
              className="mt-auto"
            />
          </div>
        ))}
      </div>
      <Message error={state.error} info={state.info} />
      <Button type="submit" disabled={pending}>
        {pending ? de.common.loading : de.admin.scoringSave}
      </Button>
    </form>
  );
}
