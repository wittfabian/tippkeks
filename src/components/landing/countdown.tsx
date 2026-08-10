"use client";

import { useCountdown } from "@/lib/hooks/use-countdown";
import { de } from "@/messages/de";

// Opening match of the FIFA World Cup 2026 (Estadio Azteca) and the day after
// the final. Purely decorative; a few minutes' drift either way is irrelevant —
// but the end matters, because without it the hero would go on inviting people
// to a tournament that finished weeks ago.
const KICKOFF_MS = new Date("2026-06-11T19:00:00Z").getTime();
const OVER_MS = new Date("2026-07-20T00:00:00Z").getTime();

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
  // is no hydration mismatch); `null` = that moment has passed. Two clocks, so
  // the three states — counting down, running, over — are read off the calendar
  // rather than hard-coded.
  const untilKickoff = useCountdown(KICKOFF_MS);
  const untilOver = useCountdown(OVER_MS);

  if (untilKickoff === undefined || untilOver === undefined) {
    return <div className="h-[4.5rem]" aria-hidden />;
  }

  if (untilOver === null) {
    return (
      <p className="font-heading text-lg font-bold text-white/60" role="status">
        {de.landing.finished}
      </p>
    );
  }

  if (untilKickoff === null) {
    return (
      <p className="font-heading text-reward text-lg font-bold" role="status">
        {de.landing.live}
      </p>
    );
  }

  const remaining = untilKickoff;

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
