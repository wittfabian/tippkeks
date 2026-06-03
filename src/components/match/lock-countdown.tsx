"use client";

import { useCountdown } from "@/lib/hooks/use-countdown";
import { de } from "@/messages/de";

/**
 * Live ticking countdown to a target time (the tip deadline = kickoff). Renders
 * nothing until mounted to avoid a hydration mismatch, and disappears once the
 * deadline passes.
 */
export function LockCountdown({ target, className }: { target: string; className?: string }) {
  const remaining = useCountdown(new Date(target).getTime());

  if (remaining === undefined) return <span className={className} suppressHydrationWarning />;
  if (remaining === null) return null;

  const { days, hours, minutes, seconds } = remaining;
  const pad = (n: number) => String(n).padStart(2, "0");
  const label =
    days > 0
      ? de.fixtures.lockCountdown(days, hours)
      : `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;

  return (
    <span className={className} aria-live="off">
      {label}
    </span>
  );
}
