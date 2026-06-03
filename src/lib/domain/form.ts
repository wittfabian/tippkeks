export type FormResult = { kickoff: string; hit: boolean };

export interface FormSummary {
  /** Up to 5 most recent results, oldest → newest. */
  recent: ("hit" | "miss")[];
  /** Consecutive hits ending at the most recent result (0 if it missed). */
  streak: number;
}

/**
 * Summarise a member's scored results into recent form + the current hit
 * streak. Pure (no DB / no `server-only`) so it is unit-testable and reusable.
 * Input order does not matter — results are sorted by kickoff ascending first.
 */
export function summariseForm(results: FormResult[]): FormSummary {
  const sorted = [...results].sort((a, b) => a.kickoff.localeCompare(b.kickoff));
  const recent = sorted.slice(-5).map((r) => (r.hit ? "hit" : "miss") as "hit" | "miss");
  let streak = 0;
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (!sorted[i]?.hit) break;
    streak++;
  }
  return { recent, streak };
}
