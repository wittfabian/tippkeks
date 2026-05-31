import { cached } from "@/lib/cache/cache";
import type { ScoreCategory, StageKind } from "@/lib/scoring/engine";
import type { FixtureStatus } from "@/lib/providers/types";
import type { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

export interface TeamLite {
  id: number;
  name: string;
  shortName: string | null;
  crestUrl: string | null;
}

export interface FixtureVM {
  id: number;
  kickoffAt: string;
  status: FixtureStatus;
  stageKind: StageKind;
  stageName: string;
  matchday: number | null;
  home: TeamLite | null;
  away: TeamLite | null;
  regularHome: number | null;
  regularAway: number | null;
  afterExtraTime: boolean;
  penaltyHome: number | null;
  penaltyAway: number | null;
  myPrediction: { homeGoals: number; awayGoals: number; advancingTeamId: number | null } | null;
  myPoints: number | null;
  myCategory: ScoreCategory | null;
  locked: boolean;
}

/**
 * Global tournament data (fixtures + teams) for a set of seasons. Identical for
 * every user, so it is cached under tag "tournament" (invalidated by the sync
 * job and admin result overrides) and read with the service role — there is
 * nothing user-scoped here. NEVER add predictions/scores to this function: that
 * would put per-user data behind a shared key.
 */
async function getTournamentData(seasonIds: number[]) {
  const key = `tournament:${[...seasonIds].sort((a, b) => a - b).join(",")}`;
  return cached({ key, ttlSeconds: 60, tags: ["tournament"] }, async () => {
    const service = createServiceClient();
    const [{ data: fixtures }, { data: teams }] = await Promise.all([
      service
        .from("fixture")
        .select(
          "id, kickoff_at, status, matchday, regular_home, regular_away, after_extra_time, penalty_home, penalty_away, home_team_id, away_team_id, stage:stage_id(kind, name)",
        )
        .in("season_id", seasonIds)
        .order("kickoff_at", { ascending: true }),
      service.from("team").select("id, name, short_name, crest_url"),
    ]);
    const teamList: TeamLite[] = (teams ?? []).map((t) => ({
      id: t.id,
      name: t.name,
      shortName: t.short_name,
      crestUrl: t.crest_url,
    }));
    return { fixtures: fixtures ?? [], teams: teamList };
  });
}

/**
 * Build the tipping board for a tenant member: every fixture in the tenant's
 * subscribed seasons, joined with the caller's own prediction and score. The
 * global fixtures/teams come from the cache; predictions/scores are read live
 * through the caller's RLS-scoped client and merged in.
 */
export async function getFixtureBoard(
  supabase: ServerClient,
  tenantId: string,
  userId: string,
): Promise<FixtureVM[]> {
  const { data: subscriptions } = await supabase
    .from("tenant_season")
    .select("season_id")
    .eq("tenant_id", tenantId);
  const seasonIds = (subscriptions ?? []).map((s) => s.season_id);
  if (seasonIds.length === 0) return [];

  const [{ fixtures, teams }, { data: predictions }, { data: scores }] = await Promise.all([
    getTournamentData(seasonIds),
    supabase
      .from("prediction")
      .select("fixture_id, home_goals, away_goals, advancing_team_id")
      .eq("tenant_id", tenantId)
      .eq("user_id", userId),
    supabase
      .from("prediction_score")
      .select("fixture_id, points, category")
      .eq("tenant_id", tenantId)
      .eq("user_id", userId),
  ]);

  const teamById = new Map<number, TeamLite>(teams.map((t) => [t.id, t]));
  const predByFixture = new Map((predictions ?? []).map((p) => [p.fixture_id, p]));
  const scoreByFixture = new Map((scores ?? []).map((s) => [s.fixture_id, s]));
  const now = Date.now();

  return (fixtures ?? []).map((f) => {
    const pred = predByFixture.get(f.id);
    const score = scoreByFixture.get(f.id);
    return {
      id: f.id,
      kickoffAt: f.kickoff_at,
      status: f.status,
      stageKind: (f.stage?.kind ?? "other") as StageKind,
      stageName: f.stage?.name ?? "",
      matchday: f.matchday,
      home: f.home_team_id != null ? (teamById.get(f.home_team_id) ?? null) : null,
      away: f.away_team_id != null ? (teamById.get(f.away_team_id) ?? null) : null,
      regularHome: f.regular_home,
      regularAway: f.regular_away,
      afterExtraTime: f.after_extra_time,
      penaltyHome: f.penalty_home,
      penaltyAway: f.penalty_away,
      myPrediction: pred
        ? {
            homeGoals: pred.home_goals,
            awayGoals: pred.away_goals,
            advancingTeamId: pred.advancing_team_id,
          }
        : null,
      myPoints: score?.points ?? null,
      myCategory: (score?.category ?? null) as ScoreCategory | null,
      locked: new Date(f.kickoff_at).getTime() <= now,
    };
  });
}
