"use client";

import { useActionState } from "react";

import {
  createInviteAction,
  overrideResultAction,
  removeMemberAction,
  saveScoringAction,
  setMemberRoleAction,
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

export function CreateInviteButton({ tenantId, slug }: { tenantId: string; slug: string }) {
  const [state, formAction, pending] = useActionState(createInviteAction, initialActionState);
  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="tenantId" value={tenantId} />
      <input type="hidden" name="slug" value={slug} />
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? de.common.loading : de.admin.createInvite}
      </Button>
      <Message error={state.error} info={state.info} />
    </form>
  );
}

export function MemberRowActions({
  tenantId,
  slug,
  targetUserId,
  role,
}: {
  tenantId: string;
  slug: string;
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
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="targetUserId" value={targetUserId} />
          <input type="hidden" name="role" value={nextRole} />
          <Button type="submit" size="sm" variant="outline" disabled={rolePending}>
            {nextRole === "admin" ? de.admin.makeAdmin : de.admin.makeMember}
          </Button>
        </form>
        <form action={removeAction}>
          <input type="hidden" name="tenantId" value={tenantId} />
          <input type="hidden" name="slug" value={slug} />
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

export interface ScoringValues {
  exact: number;
  goalDiff: number;
  tendency: number;
  advanceBonus: number;
}

export function ScoringForm({
  tenantId,
  slug,
  values,
}: {
  tenantId: string;
  slug: string;
  values: ScoringValues;
}) {
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
      <input type="hidden" name="slug" value={slug} />
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
  slug,
  fixtureId,
  homeName,
  awayName,
}: {
  tenantId: string;
  slug: string;
  fixtureId: number;
  homeName: string;
  awayName: string;
}) {
  const [state, formAction, pending] = useActionState(overrideResultAction, initialActionState);
  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2 text-sm">
      <input type="hidden" name="tenantId" value={tenantId} />
      <input type="hidden" name="slug" value={slug} />
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
      <Button type="submit" size="sm" variant="secondary" disabled={pending}>
        {pending ? de.common.loading : de.admin.markFinished}
      </Button>
      <Message error={state.error} info={state.info} />
    </form>
  );
}
