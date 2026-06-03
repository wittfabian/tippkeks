"use client";

import { useEffect, useState } from "react";

export interface Countdown {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

/**
 * Ticking countdown to `targetMs` (epoch milliseconds). Returns:
 *  - `undefined` before mount — so the server render and first client paint
 *    match (no hydration mismatch); render a stable placeholder for it.
 *  - `null` once the target time has passed.
 *  - the remaining `{ days, hours, minutes, seconds }` otherwise.
 *
 * The clock is an external source, so all updates flow through the 1 s interval.
 */
export function useCountdown(targetMs: number): Countdown | null | undefined {
  const [remaining, setRemaining] = useState<Countdown | null | undefined>(undefined);

  useEffect(() => {
    function tick() {
      const ms = targetMs - Date.now();
      if (ms <= 0) {
        setRemaining(null);
        return;
      }
      const total = Math.floor(ms / 1000);
      setRemaining({
        days: Math.floor(total / 86_400),
        hours: Math.floor((total % 86_400) / 3_600),
        minutes: Math.floor((total % 3_600) / 60),
        seconds: total % 60,
      });
    }
    tick();
    const id = setInterval(tick, 1_000);
    return () => clearInterval(id);
  }, [targetMs]);

  return remaining;
}
