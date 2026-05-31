import { describe, expect, it } from "vitest";

import {
  DEFAULT_SCORING_CONFIG,
  scorePrediction,
  type ScoringConfig,
  type StageKind,
} from "./engine";

const config: ScoringConfig = { ...DEFAULT_SCORING_CONFIG, stage_multipliers: { final: 2 } };

function score(
  predHome: number | null,
  predAway: number | null,
  resHome: number | null,
  resAway: number | null,
  stage: StageKind = "group",
) {
  return scorePrediction({
    predHome,
    predAway,
    predAdvancing: null,
    resHome,
    resAway,
    resWinner: null,
    stage,
    config,
  });
}

describe("scorePrediction", () => {
  it("awards exact points for a perfect score", () => {
    expect(score(2, 1, 2, 1)).toEqual({ points: 4, category: "exact" });
  });

  it("awards goal-difference points for the right margin", () => {
    expect(score(3, 1, 2, 0)).toEqual({ points: 3, category: "goal_diff" });
  });

  it("treats a wrong-but-drawn prediction as goal difference", () => {
    expect(score(2, 2, 1, 1)).toEqual({ points: 3, category: "goal_diff" });
  });

  it("awards tendency points for the right winner only", () => {
    expect(score(1, 0, 3, 1)).toEqual({ points: 2, category: "tendency" });
  });

  it("awards nothing for the wrong tendency", () => {
    expect(score(0, 1, 2, 0)).toEqual({ points: 0, category: "miss" });
  });

  it("applies the per-stage multiplier", () => {
    expect(score(2, 1, 2, 1, "final")).toEqual({ points: 8, category: "exact" });
  });

  it("returns miss when the result is unknown", () => {
    expect(score(2, 1, null, null)).toEqual({ points: 0, category: "miss" });
  });

  it("adds the advancing-team bonus when the predicted team wins", () => {
    const outcome = scorePrediction({
      predHome: 1,
      predAway: 1,
      predAdvancing: 5,
      resHome: 1,
      resAway: 1,
      resWinner: 5,
      stage: "final",
      config,
    });
    // 1:1 vs 1:1 is exact (4) x2 (final) + advance bonus (2) = 10.
    expect(outcome).toEqual({ points: 10, category: "exact" });
  });

  it("does not add the bonus when the advancing prediction is wrong", () => {
    const outcome = scorePrediction({
      predHome: 0,
      predAway: 0,
      predAdvancing: 5,
      resHome: 0,
      resAway: 0,
      resWinner: 9,
      stage: "group",
      config,
    });
    expect(outcome).toEqual({ points: 4, category: "exact" });
  });
});
