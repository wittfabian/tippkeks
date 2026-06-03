import { describe, expect, it } from "vitest";

import { summariseForm } from "./form";

describe("summariseForm", () => {
  it("returns empty form and zero streak for no results", () => {
    expect(summariseForm([])).toEqual({ recent: [], streak: 0 });
  });

  it("orders results by kickoff ascending regardless of input order", () => {
    const { recent } = summariseForm([
      { kickoff: "2026-06-13T18:00:00Z", hit: false },
      { kickoff: "2026-06-11T18:00:00Z", hit: true },
      { kickoff: "2026-06-12T18:00:00Z", hit: true },
    ]);
    expect(recent).toEqual(["hit", "hit", "miss"]);
  });

  it("keeps only the 5 most recent results, newest last", () => {
    const results = Array.from({ length: 7 }, (_, i) => ({
      kickoff: `2026-06-${String(i + 1).padStart(2, "0")}T18:00:00Z`,
      hit: i >= 5, // only the last two are hits
    }));
    const { recent } = summariseForm(results);
    expect(recent).toHaveLength(5);
    expect(recent).toEqual(["miss", "miss", "miss", "hit", "hit"]);
  });

  it("counts the trailing hit streak and stops at the most recent miss", () => {
    const { streak } = summariseForm([
      { kickoff: "2026-06-11T18:00:00Z", hit: true },
      { kickoff: "2026-06-12T18:00:00Z", hit: false },
      { kickoff: "2026-06-13T18:00:00Z", hit: true },
      { kickoff: "2026-06-14T18:00:00Z", hit: true },
    ]);
    expect(streak).toBe(2);
  });

  it("reports a zero streak when the most recent result is a miss", () => {
    const { streak } = summariseForm([
      { kickoff: "2026-06-11T18:00:00Z", hit: true },
      { kickoff: "2026-06-12T18:00:00Z", hit: false },
    ]);
    expect(streak).toBe(0);
  });

  it("counts a streak longer than the visible 5-match form window", () => {
    const results = Array.from({ length: 8 }, (_, i) => ({
      kickoff: `2026-06-${String(i + 1).padStart(2, "0")}T18:00:00Z`,
      hit: true,
    }));
    const { recent, streak } = summariseForm(results);
    expect(recent).toHaveLength(5);
    expect(streak).toBe(8);
  });
});
