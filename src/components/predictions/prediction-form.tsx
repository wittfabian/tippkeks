"use client";

import { Minus, Plus } from "lucide-react";
import { useActionState, useState } from "react";

import { submitPredictionAction } from "@/actions/predictions";
import { initialActionState } from "@/actions/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { flagForCode } from "@/lib/i18n/teamFlags";
import { cn } from "@/lib/utils";
import { de } from "@/messages/de";

export interface PredictionFormProps {
  tenantId: string;
  fixtureId: string;
  homeName: string;
  awayName: string;
  homeCode: string | null;
  awayCode: string | null;
  knockout: boolean;
  homeTeamId: string | null;
  awayTeamId: string | null;
  initial: { homeGoals: number; awayGoals: number; advancingTeamId: string | null } | null;
}

const QUICK_TIPS: [number, number][] = [
  [0, 0],
  [1, 0],
  [2, 1],
  [1, 1],
];

function clampGoals(value: number): string {
  return String(Math.max(0, Math.min(99, value)));
}

function Stepper({
  value,
  onChange,
  label,
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  id: string;
}) {
  const step = (delta: number) => onChange(clampGoals((Number(value) || 0) + delta));
  return (
    <div className="flex items-center gap-1">
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="size-9 shrink-0"
        aria-label={`${label} −`}
        onClick={() => step(-1)}
      >
        <Minus className="size-4" />
      </Button>
      <label className="sr-only" htmlFor={id}>
        {label}
      </label>
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        min={0}
        max={99}
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="font-heading h-9 w-12 px-0 text-center text-lg font-bold tabular-nums"
      />
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="size-9 shrink-0"
        aria-label={`${label} +`}
        onClick={() => step(1)}
      >
        <Plus className="size-4" />
      </Button>
    </div>
  );
}

export function PredictionForm(props: PredictionFormProps) {
  const [state, formAction, pending] = useActionState(submitPredictionAction, initialActionState);
  const [home, setHome] = useState(props.initial ? String(props.initial.homeGoals) : "");
  const [away, setAway] = useState(props.initial ? String(props.initial.awayGoals) : "");
  const [advancing, setAdvancing] = useState(
    props.initial?.advancingTeamId != null ? String(props.initial.advancingTeamId) : "",
  );
  const showAdvancing = props.knockout && props.homeTeamId != null && props.awayTeamId != null;

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="tenantId" value={props.tenantId} />
      <input type="hidden" name="fixtureId" value={props.fixtureId} />
      <input type="hidden" name="homeGoals" value={home} />
      <input type="hidden" name="awayGoals" value={away} />
      <input type="hidden" name="advancingTeamId" value={advancing} />

      <div className="flex items-center justify-center gap-3">
        <Stepper
          value={home}
          onChange={setHome}
          label={`${de.admin.homeGoals} ${props.homeName}`}
          id={`home-${props.fixtureId}`}
        />
        <span className="text-muted-foreground font-heading text-lg font-bold" aria-hidden>
          :
        </span>
        <Stepper
          value={away}
          onChange={setAway}
          label={`${de.admin.awayGoals} ${props.awayName}`}
          id={`away-${props.fixtureId}`}
        />
      </div>

      <div className="flex flex-wrap items-center justify-center gap-1.5">
        <span className="text-muted-foreground text-xs">{de.fixtures.quick}</span>
        {QUICK_TIPS.map(([h, a]) => {
          const active = home === String(h) && away === String(a);
          return (
            <Button
              key={`${h}-${a}`}
              type="button"
              variant={active ? "default" : "secondary"}
              size="xs"
              className="tabular-nums"
              onClick={() => {
                setHome(String(h));
                setAway(String(a));
              }}
            >
              {h}:{a}
            </Button>
          );
        })}
      </div>

      {showAdvancing && (
        <div className="space-y-1">
          <p className="text-muted-foreground text-center text-xs">{de.fixtures.advancingTeam}</p>
          <div className="flex justify-center gap-2">
            {[
              { id: props.homeTeamId, name: props.homeName, code: props.homeCode },
              { id: props.awayTeamId, name: props.awayName, code: props.awayCode },
            ].map((t) => {
              const idStr = String(t.id);
              const active = advancing === idStr;
              return (
                <Button
                  key={idStr}
                  type="button"
                  variant={active ? "default" : "outline"}
                  size="sm"
                  className={cn("gap-1", active && "ring-primary ring-2")}
                  onClick={() => setAdvancing(active ? "" : idStr)}
                >
                  <span aria-hidden>{flagForCode(t.code)}</span>
                  {t.name}
                </Button>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        {state.error ? (
          <p role="alert" className="text-destructive text-xs">
            {state.error}
          </p>
        ) : state.info ? (
          <p role="status" className="text-xs text-emerald-600 dark:text-emerald-400">
            {state.info}
          </p>
        ) : (
          <span />
        )}
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? de.common.loading : de.fixtures.save}
        </Button>
      </div>
    </form>
  );
}
