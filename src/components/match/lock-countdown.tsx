"use client";

import { useEffect, useState } from "react";

/**
 * Live ticking countdown to a target time (the tip deadline = kickoff). Renders
 * nothing until mounted to avoid a hydration mismatch, and disappears once the
 * deadline passes.
 */
export function LockCountdown({ target, className }: { target: string; className?: string }) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const initial = setTimeout(tick, 0);
    const id = setInterval(tick, 1000);
    return () => {
      clearTimeout(initial);
      clearInterval(id);
    };
  }, []);

  if (now === null) return <span className={className} suppressHydrationWarning />;

  const diff = new Date(target).getTime() - now;
  if (diff <= 0) return null;

  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");

  const label =
    days > 0 ? `${days} T ${hours} Std` : `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;

  return (
    <span className={className} aria-live="off">
      {label}
    </span>
  );
}
