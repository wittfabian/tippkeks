import { afterEach, describe, expect, it, vi } from "vitest";

// Decouple from the real environment: the provider only needs a token to be
// present for the request to proceed; the network is mocked below.
vi.mock("@/lib/env.server", () => ({
  serverEnv: { FOOTBALL_DATA_API_TOKEN: "test-token", FOOTBALL_DATA_COMPETITION: "WC" },
}));

import { footballDataProvider } from "@/lib/providers/footballData";

interface FakeMatch {
  id: number;
  utcDate: string;
  status: string;
  stage: string;
  matchday: number | null;
  homeTeam: { id: number; name: string; tla: string };
  awayTeam: { id: number; name: string; tla: string };
  score: {
    winner: "HOME_TEAM" | "AWAY_TEAM" | "DRAW" | null;
    duration: "REGULAR" | "EXTRA_TIME" | "PENALTY_SHOOTOUT";
    fullTime: { home: number | null; away: number | null };
    penalties?: { home: number | null; away: number | null };
  };
}

function stubFetch(matches: FakeMatch[]) {
  const json = (body: unknown) =>
    Promise.resolve({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => body,
    } as Response);

  vi.stubGlobal(
    "fetch",
    vi.fn((url: string | URL) => {
      const path = String(url);
      if (path.endsWith("/matches")) return json({ matches });
      return json({
        id: 1,
        name: "FIFA World Cup",
        currentSeason: { id: 10, startDate: "2026-06-11", endDate: "2026-07-19" },
      });
    }),
  );
}

const baseMatch: FakeMatch = {
  id: 100,
  utcDate: "2026-06-30T18:00:00Z",
  status: "FINISHED",
  stage: "LAST_32",
  matchday: null,
  homeTeam: { id: 1, name: "Germany", tla: "GER" },
  awayTeam: { id: 2, name: "Paraguay", tla: "PAR" },
  score: {
    winner: "AWAY_TEAM",
    duration: "PENALTY_SHOOTOUT",
    fullTime: { home: 4, away: 5 },
    penalties: { home: 3, away: 4 },
  },
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("footballDataProvider score mapping", () => {
  it("strips shoot-out goals out of fullTime so the regular score is the a.e.t. scoreline", async () => {
    // football-data reports Germany 1:1 Paraguay (a.e.t.), lost 3:4 on penalties
    // as fullTime 4:5 with penalties 3:4. We must store 1:1, not 4:5.
    stubFetch([baseMatch]);

    const season = await footballDataProvider().fetchSeason();
    const fixture = season.fixtures[0];

    expect(fixture).toBeDefined();
    expect(fixture?.regularHome).toBe(1);
    expect(fixture?.regularAway).toBe(1);
    expect(fixture?.afterExtraTime).toBe(true);
    expect(fixture?.penaltyHome).toBe(3);
    expect(fixture?.penaltyAway).toBe(4);
  });

  it("leaves the score untouched for matches without a shoot-out", async () => {
    stubFetch([
      {
        ...baseMatch,
        score: {
          winner: "HOME_TEAM",
          duration: "EXTRA_TIME",
          fullTime: { home: 2, away: 1 },
        },
      },
    ]);

    const fixture = (await footballDataProvider().fetchSeason()).fixtures[0];

    expect(fixture?.regularHome).toBe(2);
    expect(fixture?.regularAway).toBe(1);
    expect(fixture?.afterExtraTime).toBe(true);
    expect(fixture?.penaltyHome).toBeNull();
    expect(fixture?.penaltyAway).toBeNull();
  });

  it("keeps the score null for unfinished matches", async () => {
    stubFetch([
      {
        ...baseMatch,
        status: "TIMED",
        score: { winner: null, duration: "REGULAR", fullTime: { home: null, away: null } },
      },
    ]);

    const fixture = (await footballDataProvider().fetchSeason()).fixtures[0];

    expect(fixture?.regularHome).toBeNull();
    expect(fixture?.regularAway).toBeNull();
  });
});
