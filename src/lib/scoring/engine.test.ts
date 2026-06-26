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
    expect(score(2, 1, 2, 1)).toEqual({ points: 3, category: "exact" });
  });

  it("awards goal-difference points for the right margin", () => {
    expect(score(3, 1, 2, 0)).toEqual({ points: 2, category: "goal_diff" });
  });

  it("treats a wrong-but-drawn prediction as goal difference", () => {
    expect(score(2, 2, 1, 1)).toEqual({ points: 2, category: "goal_diff" });
  });

  it("awards tendency points for the right winner only", () => {
    expect(score(1, 0, 3, 1)).toEqual({ points: 1, category: "tendency" });
  });

  it("awards nothing for the wrong tendency", () => {
    expect(score(0, 1, 2, 0)).toEqual({ points: 0, category: "miss" });
  });

  it("applies the per-stage multiplier", () => {
    expect(score(2, 1, 2, 1, "final")).toEqual({ points: 6, category: "exact" });
  });

  it("returns miss when the result is unknown", () => {
    expect(score(2, 1, null, null)).toEqual({ points: 0, category: "miss" });
  });

  it("adds the advancing-team bonus when the predicted team wins", () => {
    const outcome = scorePrediction({
      predHome: 1,
      predAway: 1,
      predAdvancing: "team-5",
      resHome: 1,
      resAway: 1,
      resWinner: "team-5",
      stage: "final",
      config,
    });
    // 1:1 vs 1:1 is exact (3) x2 (final) + advance bonus (2) = 8.
    expect(outcome).toEqual({ points: 8, category: "exact" });
  });

  it("adds penalty shoot-out goals to the result (1:1 a.e.t. + 4:3 -> 5:4)", () => {
    const outcome = scorePrediction({
      predHome: 5,
      predAway: 4,
      predAdvancing: null,
      resHome: 1,
      resAway: 1,
      resPenaltyHome: 4,
      resPenaltyAway: 3,
      resWinner: null,
      stage: "final",
      config,
    });
    // 5:4 vs 5:4 is exact (3) x2 (final) = 6.
    expect(outcome).toEqual({ points: 6, category: "exact" });
  });

  it("treats a draw tip as a miss once the shoot-out decides the result", () => {
    const outcome = scorePrediction({
      predHome: 1,
      predAway: 1,
      predAdvancing: null,
      resHome: 1,
      resAway: 1,
      resPenaltyHome: 4,
      resPenaltyAway: 3,
      resWinner: null,
      stage: "semi_final",
      config,
    });
    // Effective result 5:4 (home win); a 1:1 draw tip is the wrong tendency.
    expect(outcome).toEqual({ points: 0, category: "miss" });
  });

  it("scores the home-win tendency from the shoot-out result", () => {
    const outcome = scorePrediction({
      predHome: 2,
      predAway: 0,
      predAdvancing: null,
      resHome: 1,
      resAway: 1,
      resPenaltyHome: 4,
      resPenaltyAway: 3,
      resWinner: null,
      stage: "semi_final",
      config,
    });
    // Effective result 5:4 → home win; 2:0 is the right tendency only.
    expect(outcome).toEqual({ points: 1, category: "tendency" });
  });

  it("does not add the bonus when the advancing prediction is wrong", () => {
    const outcome = scorePrediction({
      predHome: 0,
      predAway: 0,
      predAdvancing: "team-5",
      resHome: 0,
      resAway: 0,
      resWinner: "team-9",
      stage: "group",
      config,
    });
    expect(outcome).toEqual({ points: 3, category: "exact" });
  });
});
