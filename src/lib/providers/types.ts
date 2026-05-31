import type { StageKind } from "@/lib/scoring/engine";

export type FixtureStatus =
  | "scheduled"
  | "live"
  | "finished"
  | "postponed"
  | "abandoned"
  | "cancelled";

export interface NormalizedTeam {
  externalId: string;
  name: string;
  shortName: string | null;
  countryCode: string | null;
  crestUrl: string | null;
}

export interface NormalizedFixture {
  externalId: string;
  stageKind: StageKind;
  matchday: number | null;
  homeTeamExternalId: string | null;
  awayTeamExternalId: string | null;
  kickoffAt: string; // ISO 8601 UTC
  status: FixtureStatus;
  /** Regulation (90') result as best the provider exposes it. */
  regularHome: number | null;
  regularAway: number | null;
  afterExtraTime: boolean;
  penaltyHome: number | null;
  penaltyAway: number | null;
  winnerTeamExternalId: string | null;
}

export interface NormalizedSeason {
  competition: { externalId: string; name: string };
  season: {
    externalId: string;
    label: string;
    startsOn: string | null;
    endsOn: string | null;
  };
  teams: NormalizedTeam[];
  fixtures: NormalizedFixture[];
}

export interface FixtureProvider {
  readonly name: string;
  fetchSeason(): Promise<NormalizedSeason>;
}

/** Thrown on HTTP 429 so the caller can back off and retry. */
export class RateLimitError extends Error {
  constructor(public readonly retryAfterSeconds: number) {
    super(`Rate limited; retry after ${retryAfterSeconds}s`);
    this.name = "RateLimitError";
  }
}
