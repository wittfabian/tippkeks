/**
 * Pure TypeScript mirror of the SQL public.score_prediction() function.
 *
 * NOT authoritative: real points are written by the SQL function inside the
 * same transaction as the result (see supabase/migrations/...functions_rpc.sql).
 * This mirror exists only for unit tests (parity with the SQL) and the in-form
 * "you'd get N points" preview. Keep it byte-for-byte equivalent to the SQL.
 */

export type StageKind =
  | "group"
  | "last_32"
  | "last_16"
  | "quarter_final"
  | "semi_final"
  | "third_place"
  | "final"
  | "matchday"
  | "other";

export type ScoreCategory = "exact" | "goal_diff" | "tendency" | "miss";

export interface ScoringConfig {
  /** Points for an exact correct score. */
  exact: number;
  /** Points for the correct goal difference (incl. correct draw, not exact). */
  goal_diff: number;
  /** Points for the correct tendency (winner/loser) only. */
  tendency: number;
  /** Bonus when the predicted advancing team equals the actual winner. */
  advance_bonus: number;
  /** Optional per-stage multiplier applied to the base points (floored). */
  stage_multipliers: Partial<Record<StageKind, number>>;
}

export interface ScoreOutcome {
  points: number;
  category: ScoreCategory;
}

export const DEFAULT_SCORING_CONFIG: ScoringConfig = {
  exact: 4,
  goal_diff: 3,
  tendency: 2,
  advance_bonus: 2,
  stage_multipliers: {},
};

export interface ScoreInput {
  predHome: number | null;
  predAway: number | null;
  predAdvancing: number | null;
  /** Regulation (90') result — the basis for score predictions. */
  resHome: number | null;
  resAway: number | null;
  /** Actual winner (post extra-time/penalties) for the advancing bonus. */
  resWinner: number | null;
  stage: StageKind;
  config: ScoringConfig;
}

export function scorePrediction(input: ScoreInput): ScoreOutcome {
  const { predHome, predAway, predAdvancing, resHome, resAway, resWinner, stage, config } = input;

  if (predHome == null || predAway == null || resHome == null || resAway == null) {
    return { points: 0, category: "miss" };
  }

  const predDiff = predHome - predAway;
  const resDiff = resHome - resAway;

  let category: ScoreCategory;
  let base: number;

  if (predHome === resHome && predAway === resAway) {
    category = "exact";
    base = config.exact;
  } else if (predDiff === resDiff) {
    category = "goal_diff";
    base = config.goal_diff;
  } else if (Math.sign(predDiff) === Math.sign(resDiff)) {
    category = "tendency";
    base = config.tendency;
  } else {
    category = "miss";
    base = 0;
  }

  const multiplier = config.stage_multipliers[stage] ?? 1;
  let points = Math.floor(base * multiplier);

  if (predAdvancing != null && resWinner != null && predAdvancing === resWinner) {
    points += config.advance_bonus;
  }

  return { points, category };
}
