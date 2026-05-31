"use client";

import { useActionState, useState } from "react";

import { submitPredictionAction } from "@/actions/predictions";
import { initialActionState } from "@/actions/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { de } from "@/messages/de";

export interface PredictionFormProps {
  tenantId: string;
  slug: string;
  fixtureId: number;
  homeName: string;
  awayName: string;
  knockout: boolean;
  homeTeamId: number | null;
  awayTeamId: number | null;
  initial: { homeGoals: number; awayGoals: number; advancingTeamId: number | null } | null;
}

export function PredictionForm(props: PredictionFormProps) {
  const [state, formAction, pending] = useActionState(submitPredictionAction, initialActionState);
  // Controlled inputs so revalidation after a save never changes an uncontrolled
  // field's default (which the UI primitive warns about), and the success
  // message survives the re-render.
  const [home, setHome] = useState(props.initial ? String(props.initial.homeGoals) : "");
  const [away, setAway] = useState(props.initial ? String(props.initial.awayGoals) : "");
  const [advancing, setAdvancing] = useState(
    props.initial?.advancingTeamId != null ? String(props.initial.advancingTeamId) : "",
  );
  const showAdvancing = props.knockout && props.homeTeamId != null && props.awayTeamId != null;

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="tenantId" value={props.tenantId} />
      <input type="hidden" name="slug" value={props.slug} />
      <input type="hidden" name="fixtureId" value={props.fixtureId} />

      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-right">{props.homeName}</span>
        <label className="sr-only" htmlFor={`home-${props.fixtureId}`}>
          {de.admin.homeGoals}
        </label>
        <Input
          id={`home-${props.fixtureId}`}
          type="number"
          name="homeGoals"
          min={0}
          max={99}
          required
          value={home}
          onChange={(e) => setHome(e.target.value)}
          className="w-14 text-center"
        />
        <span aria-hidden>:</span>
        <label className="sr-only" htmlFor={`away-${props.fixtureId}`}>
          {de.admin.awayGoals}
        </label>
        <Input
          id={`away-${props.fixtureId}`}
          type="number"
          name="awayGoals"
          min={0}
          max={99}
          required
          value={away}
          onChange={(e) => setAway(e.target.value)}
          className="w-14 text-center"
        />
        <span className="min-w-0 flex-1 truncate">{props.awayName}</span>
      </div>

      {showAdvancing && (
        <div className="flex items-center justify-center gap-2 text-sm">
          <label htmlFor={`adv-${props.fixtureId}`} className="text-muted-foreground">
            {de.fixtures.advancingTeam}
          </label>
          <select
            id={`adv-${props.fixtureId}`}
            name="advancingTeamId"
            value={advancing}
            onChange={(e) => setAdvancing(e.target.value)}
            className="border-input bg-background rounded-md border px-2 py-1"
          >
            <option value="">{de.fixtures.noAdvancing}</option>
            <option value={String(props.homeTeamId)}>{props.homeName}</option>
            <option value={String(props.awayTeamId)}>{props.awayName}</option>
          </select>
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        {state.error ? (
          <p role="alert" className="text-destructive text-xs">
            {state.error}
          </p>
        ) : state.info ? (
          <p role="status" className="text-xs text-emerald-600">
            {state.info}
          </p>
        ) : (
          <span />
        )}
        <Button type="submit" size="sm" variant="secondary" disabled={pending}>
          {pending ? de.common.loading : de.fixtures.save}
        </Button>
      </div>
    </form>
  );
}
