"use client";

import { useEffect, useState } from "react";

import { de } from "@/messages/de";

// Opening match of the FIFA World Cup 2026 (Estadio Azteca). Purely decorative;
// a few minutes' drift either way is irrelevant.
const KICKOFF_MS = new Date("2026-06-11T19:00:00Z").getTime();

type Remaining = { days: number; hours: number; minutes: number; seconds: number };

function remainingUntilKickoff(): Remaining | null {
  const ms = KICKOFF_MS - Date.now();
  if (ms <= 0) return null;
  const total = Math.floor(ms / 1000);
  return {
    days: Math.floor(total / 86_400),
    hours: Math.floor((total % 86_400) / 3_600),
    minutes: Math.floor((total % 3_600) / 60),
    seconds: total % 60,
  };
}

function Tile({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="font-heading min-w-[2.2ch] text-3xl font-extrabold text-white tabular-nums sm:text-4xl">
        {value.toString().padStart(2, "0")}
      </span>
      <span className="mt-1 text-[0.65rem] font-medium tracking-[0.18em] text-white/45 uppercase">
        {label}
      </span>
    </div>
  );
}

export function Countdown() {
  // `undefined` = not yet computed (server render + first client paint, so there
  // is no hydration mismatch); `null` = kickoff reached. The clock is an external
  // source, so all updates happen through the interval subscription.
  const [remaining, setRemaining] = useState<Remaining | null | undefined>(undefined);

  useEffect(() => {
    function tick() {
      setRemaining(remainingUntilKickoff());
    }
    tick();
    const id = setInterval(tick, 1_000);
    return () => clearInterval(id);
  }, []);

  if (remaining === undefined) return <div className="h-[4.5rem]" aria-hidden />;

  if (remaining === null) {
    return (
      <p className="font-heading text-reward text-lg font-bold" role="status">
        {de.landing.live}
      </p>
    );
  }

  const { units } = de.landing;
  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-xs font-medium tracking-[0.2em] text-white/45 uppercase">
        {de.landing.kickoffIn}
      </span>
      <div className="flex items-start gap-4 sm:gap-6">
        <Tile value={remaining.days} label={units.days} />
        <span className="font-heading text-2xl font-bold text-white/20 sm:text-3xl">:</span>
        <Tile value={remaining.hours} label={units.hours} />
        <span className="font-heading text-2xl font-bold text-white/20 sm:text-3xl">:</span>
        <Tile value={remaining.minutes} label={units.minutes} />
        <span className="font-heading text-2xl font-bold text-white/20 sm:text-3xl">:</span>
        <Tile value={remaining.seconds} label={units.seconds} />
      </div>
    </div>
  );
}
