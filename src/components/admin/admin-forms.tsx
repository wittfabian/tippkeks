"use client";

import { useActionState } from "react";

import {
  createInviteAction,
  deleteInviteAction,
  overrideResultAction,
  removeMemberAction,
  saveMemberTipsAction,
  saveScoringAction,
  setMemberRoleAction,
  setMemberTippingAction,
} from "@/actions/admin";
import { initialActionState } from "@/actions/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
}: {
  tenantId: string;
  fixtureId: string;
  homeName: string;
  awayName: string;
  members: MemberTipRow[];
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
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? de.common.loading : de.admin.tipsSave}
        </Button>
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
  const fields: { name: keyof ScoringValues; label: string }[] = [
    { name: "exact", label: de.admin.scoringExact },
    { name: "goalDiff", label: de.admin.scoringDiff },
    { name: "tendency", label: de.admin.scoringTendency },
    { name: "advanceBonus", label: de.admin.scoringAdvance },
  ];
  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="tenantId" value={tenantId} />
      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map((f) => (
          <div key={f.name} className="space-y-1.5">
            <Label htmlFor={f.name}>{f.label}</Label>
            <Input
              id={f.name}
              name={f.name}
              type="number"
              min={0}
              max={100}
              required
              defaultValue={values[f.name]}
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

export function ResultForm({
  tenantId,
  fixtureId,
  homeName,
  awayName,
}: {
  tenantId: string;
  fixtureId: string;
  homeName: string;
  awayName: string;
}) {
  const [state, formAction, pending] = useActionState(overrideResultAction, initialActionState);
  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2 text-sm">
      <input type="hidden" name="tenantId" value={tenantId} />
      <input type="hidden" name="fixtureId" value={fixtureId} />
      <span className="min-w-28 flex-1 truncate text-right">{homeName}</span>
      <Input
        type="number"
        name="homeGoals"
        min={0}
        max={99}
        required
        aria-label={de.admin.homeGoals}
        className="w-14 text-center"
      />
      <span aria-hidden>:</span>
      <Input
        type="number"
        name="awayGoals"
        min={0}
        max={99}
        required
        aria-label={de.admin.awayGoals}
        className="w-14 text-center"
      />
      <span className="min-w-28 flex-1 truncate">{awayName}</span>
      <label className="text-muted-foreground flex cursor-pointer items-center gap-1 text-xs">
        <input type="checkbox" name="afterExtraTime" className="size-3.5 cursor-pointer" />
        {de.admin.afterExtraTime}
      </label>
      <label className="text-muted-foreground flex items-center gap-1 text-xs">
        {de.admin.winner}
        <select
          name="winnerSide"
          defaultValue="none"
          className="border-input bg-background cursor-pointer rounded-md border px-1.5 py-1"
        >
          <option value="none">{de.admin.winnerNone}</option>
          <option value="home">{homeName}</option>
          <option value="away">{awayName}</option>
        </select>
      </label>
      <Button type="submit" size="sm" variant="secondary" disabled={pending}>
        {pending ? de.common.loading : de.admin.markFinished}
      </Button>
      <Message error={state.error} info={state.info} />
    </form>
  );
}
