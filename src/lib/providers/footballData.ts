import "server-only";

import { serverEnv } from "@/lib/env.server";
import { germanTeamName } from "@/lib/i18n/teamNames";
import type { StageKind } from "@/lib/scoring/engine";
import {
  RateLimitError,
  type FixtureProvider,
  type FixtureStatus,
  type NormalizedFixture,
  type NormalizedSeason,
  type NormalizedTeam,
} from "@/lib/providers/types";

const BASE_URL = "https://api.football-data.org/v4";
const PROVIDER_NAME = "football-data";

// --- football-data.org v4 response shapes (only the fields we consume) ---

interface FdTeam {
  id: number;
  name: string;
  shortName: string | null;
  tla: string | null;
  crest: string | null;
}

interface FdMatch {
  id: number;
  utcDate: string;
  status: string;
  stage: string;
  matchday: number | null;
  homeTeam: Partial<FdTeam> & { id: number | null };
  awayTeam: Partial<FdTeam> & { id: number | null };
  score: {
    winner: "HOME_TEAM" | "AWAY_TEAM" | "DRAW" | null;
    duration: "REGULAR" | "EXTRA_TIME" | "PENALTY_SHOOTOUT";
    fullTime: { home: number | null; away: number | null };
    penalties?: { home: number | null; away: number | null };
  };
}

interface FdCompetition {
  id: number;
  name: string;
  currentSeason: { id: number; startDate: string | null; endDate: string | null };
}

function mapStage(stage: string): StageKind {
  switch (stage) {
    case "GROUP_STAGE":
      return "group";
    case "LAST_32":
    case "ROUND_OF_32":
      return "last_32";
    case "LAST_16":
    case "ROUND_OF_16":
      return "last_16";
    case "QUARTER_FINALS":
      return "quarter_final";
    case "SEMI_FINALS":
      return "semi_final";
    case "THIRD_PLACE":
      return "third_place";
    case "FINAL":
      return "final";
    default:
      return "other";
  }
}

function mapStatus(status: string): FixtureStatus {
  switch (status) {
    case "SCHEDULED":
    case "TIMED":
      return "scheduled";
    case "IN_PLAY":
    case "PAUSED":
      return "live";
    case "FINISHED":
      return "finished";
    case "POSTPONED":
    case "SUSPENDED":
      return "postponed";
    case "CANCELLED":
      return "cancelled";
    default:
      return "scheduled";
  }
}

async function request<T>(path: string): Promise<T> {
  const token = serverEnv.FOOTBALL_DATA_API_TOKEN;
  if (!token) {
    throw new Error("FOOTBALL_DATA_API_TOKEN is not set; cannot sync from football-data.org");
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "X-Auth-Token": token },
    // Always hit the network; the sync job is the only caller and owns caching.
    cache: "no-store",
  });

  if (res.status === 429) {
    const retryAfter = Number(res.headers.get("Retry-After")) || 60;
    throw new RateLimitError(retryAfter);
  }
  if (!res.ok) {
    throw new Error(`football-data.org ${path} failed: ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as T;
}

function mapTeam(team: Partial<FdTeam> & { id: number | null }): NormalizedTeam | null {
  if (team.id == null || !team.name) return null;
  return {
    externalId: String(team.id),
    name: germanTeamName(team.name),
    shortName: team.tla ?? team.shortName ?? null,
    countryCode: team.tla ?? null,
    crestUrl: team.crest ?? null,
  };
}

function winnerExternalId(match: FdMatch): string | null {
  if (match.score.winner === "HOME_TEAM")
    return match.homeTeam.id != null ? String(match.homeTeam.id) : null;
  if (match.score.winner === "AWAY_TEAM")
    return match.awayTeam.id != null ? String(match.awayTeam.id) : null;
  return null;
}

/**
 * football-data.org adapter for one competition's current season (default: the
 * FIFA World Cup, code WC).
 *
 * Knockout score caveat: `score.fullTime` is the cumulative scoreline and, for a
 * penalty shoot-out, *folds the shoot-out goals into it* (e.g. 1:1 a.e.t. won
 * 4:3 on penalties is reported as fullTime 5:4, penalties 4:3). We store the
 * after-extra-time scoreline in `regular_home/away` — the shoot-out lives
 * separately in `penalty_home/away` and is re-added only at scoring time — so we
 * subtract the shoot-out goals back out of `fullTime` here. `fullTime` already
 * includes extra-time goals, which is exactly the a.e.t. score we want.
 */
export function footballDataProvider(
  competitionCode = serverEnv.FOOTBALL_DATA_COMPETITION,
): FixtureProvider {
  return {
    name: PROVIDER_NAME,
    async fetchSeason(): Promise<NormalizedSeason> {
      const competition = await request<FdCompetition>(`/competitions/${competitionCode}`);
      const { matches } = await request<{ matches: FdMatch[] }>(
        `/competitions/${competitionCode}/matches`,
      );

      const teams = new Map<string, NormalizedTeam>();
      const fixtures: NormalizedFixture[] = [];

      for (const match of matches) {
        for (const team of [mapTeam(match.homeTeam), mapTeam(match.awayTeam)]) {
          if (team) teams.set(team.externalId, team);
        }

        const finished = match.status === "FINISHED";
        const penaltyHome = match.score.penalties?.home ?? null;
        const penaltyAway = match.score.penalties?.away ?? null;
        // `fullTime` folds the shoot-out goals in; strip them back out so the
        // stored regular score is the after-extra-time scoreline (penalties are
        // carried separately and re-added at scoring time).
        const fullTimeHome = match.score.fullTime.home;
        const fullTimeAway = match.score.fullTime.away;
        fixtures.push({
          externalId: String(match.id),
          stageKind: mapStage(match.stage),
          matchday: match.matchday ?? null,
          homeTeamExternalId: match.homeTeam.id != null ? String(match.homeTeam.id) : null,
          awayTeamExternalId: match.awayTeam.id != null ? String(match.awayTeam.id) : null,
          kickoffAt: match.utcDate,
          status: mapStatus(match.status),
          regularHome: finished && fullTimeHome != null ? fullTimeHome - (penaltyHome ?? 0) : null,
          regularAway: finished && fullTimeAway != null ? fullTimeAway - (penaltyAway ?? 0) : null,
          afterExtraTime: match.score.duration !== "REGULAR",
          penaltyHome,
          penaltyAway,
          winnerTeamExternalId: winnerExternalId(match),
        });
      }

      return {
        competition: { externalId: String(competition.id), name: competition.name },
        season: {
          externalId: String(competition.currentSeason.id),
          label:
            `${competition.name} ${competition.currentSeason.startDate?.slice(0, 4) ?? ""}`.trim(),
          startsOn: competition.currentSeason.startDate,
          endsOn: competition.currentSeason.endDate,
        },
        teams: [...teams.values()],
        fixtures,
      };
    },
  };
}
