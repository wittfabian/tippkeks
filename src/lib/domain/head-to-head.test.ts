import { describe, expect, it } from "vitest";

import { computeDuels } from "./head-to-head";

describe("computeDuels", () => {
  it("returns no records when the reference user has no scores", () => {
    const scores = [
      { fixtureId: "f1", userId: "b", points: 3 },
      { fixtureId: "f1", userId: "c", points: 1 },
    ];
    expect(computeDuels(scores, "a")).toEqual([]);
  });

  it("counts wins, losses and draws per opponent over shared fixtures", () => {
    const scores = [
      { fixtureId: "f1", userId: "me", points: 3 },
      { fixtureId: "f1", userId: "b", points: 1 }, // me wins
      { fixtureId: "f2", userId: "me", points: 0 },
      { fixtureId: "f2", userId: "b", points: 2 }, // me loses
      { fixtureId: "f3", userId: "me", points: 2 },
      { fixtureId: "f3", userId: "b", points: 2 }, // draw
    ];
    const [vsB] = computeDuels(scores, "me");
    expect(vsB).toEqual({ opponentId: "b", wins: 1, losses: 1, draws: 1 });
  });

  it("only counts a fixture for a pairing when both sides tipped it", () => {
    const scores = [
      { fixtureId: "f1", userId: "me", points: 3 },
      { fixtureId: "f1", userId: "b", points: 1 },
      // f2: only me has a score → not counted against b
      { fixtureId: "f2", userId: "me", points: 3 },
      // f3: only b has a score → not counted
      { fixtureId: "f3", userId: "b", points: 3 },
    ];
    const [vsB] = computeDuels(scores, "me");
    expect(vsB).toEqual({ opponentId: "b", wins: 1, losses: 0, draws: 0 });
  });

  it("produces a record for each distinct opponent", () => {
    const scores = [
      { fixtureId: "f1", userId: "me", points: 2 },
      { fixtureId: "f1", userId: "b", points: 1 },
      { fixtureId: "f1", userId: "c", points: 3 },
    ];
    const records = computeDuels(scores, "me");
    expect(records.map((r) => r.opponentId).sort()).toEqual(["b", "c"]);
    expect(records.find((r) => r.opponentId === "b")).toMatchObject({ wins: 1, losses: 0 });
    expect(records.find((r) => r.opponentId === "c")).toMatchObject({ wins: 0, losses: 1 });
  });
});
