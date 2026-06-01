import "server-only";

import { invalidateTags } from "@/lib/cache/cache";
import { STAGE_META } from "@/lib/domain/stages";
import type { FixtureProvider } from "@/lib/providers/types";
import { createServiceClient } from "@/lib/supabase/service";

export interface SyncReport {
  provider: string;
  teams: number;
  fixtures: number;
  scoredFixtures: number;
}

/**
 * Pull a provider's current season into Postgres idempotently. Everything keys
 * on (provider, external_id), so re-running upserts in place and never
 * duplicates. After upserting, every finished fixture is (re)scored via the SQL
 * score_fixture() function. Runs with the service role (bypasses RLS) — invoke
 * only from the sync script or the secret-protected cron route.
 */
export async function runSync(provider: FixtureProvider): Promise<SyncReport> {
  const supabase = createServiceClient();
  const data = await provider.fetchSeason();

  const { data: sport, error: sportError } = await supabase
    .from("sport")
    .upsert({ key: "football", name: "Fußball" }, { onConflict: "key" })
    .select("id")
    .single();
  if (sportError || !sport) throw sportError ?? new Error("Failed to upsert sport");

  const { data: competition, error: compError } = await supabase
    .from("competition")
    .upsert(
      {
        sport_id: sport.id,
        name: data.competition.name,
        provider: provider.name,
        external_id: data.competition.externalId,
      },
      { onConflict: "provider,external_id" },
    )
    .select("id")
    .single();
  if (compError || !competition) throw compError ?? new Error("Failed to upsert competition");

  const { data: season, error: seasonError } = await supabase
    .from("season")
    .upsert(
      {
        competition_id: competition.id,
        label: data.season.label,
        starts_on: data.season.startsOn,
        ends_on: data.season.endsOn,
        provider: provider.name,
        external_id: data.season.externalId,
      },
      { onConflict: "provider,external_id" },
    )
    .select("id")
    .single();
  if (seasonError || !season) throw seasonError ?? new Error("Failed to upsert season");

  // Stages: one row per distinct kind present in the fixtures.
  const kinds = [...new Set(data.fixtures.map((f) => f.stageKind))];
  const stageRows = kinds.map((kind) => ({
    season_id: season.id,
    kind,
    name: STAGE_META[kind].name,
    ordinal: STAGE_META[kind].ordinal,
  }));
  if (stageRows.length > 0) {
    const { error } = await supabase
      .from("stage")
      .upsert(stageRows, { onConflict: "season_id,ordinal" });
    if (error) throw error;
  }
  const { data: stages } = await supabase
    .from("stage")
    .select("id, kind")
    .eq("season_id", season.id);
  const stageIdByKind = new Map((stages ?? []).map((s) => [s.kind, s.id]));

  // Teams.
  if (data.teams.length > 0) {
    const { error } = await supabase.from("team").upsert(
      data.teams.map((t) => ({
        name: t.name,
        short_name: t.shortName,
        country_code: t.countryCode,
        crest_url: t.crestUrl,
        provider: provider.name,
        external_id: t.externalId,
      })),
      { onConflict: "provider,external_id" },
    );
    if (error) throw error;
  }
  const { data: teams } = await supabase
    .from("team")
    .select("id, external_id")
    .eq("provider", provider.name);
  const teamIdByExt = new Map((teams ?? []).map((t) => [t.external_id, t.id]));
  const resolveTeam = (ext: string | null) => (ext ? (teamIdByExt.get(ext) ?? null) : null);

  // Fixtures.
  const fixtureRows = data.fixtures.map((f) => ({
    season_id: season.id,
    stage_id: stageIdByKind.get(f.stageKind) ?? null,
    matchday: f.matchday,
    home_team_id: resolveTeam(f.homeTeamExternalId),
    away_team_id: resolveTeam(f.awayTeamExternalId),
    kickoff_at: f.kickoffAt,
    status: f.status,
    regular_home: f.regularHome,
    regular_away: f.regularAway,
    after_extra_time: f.afterExtraTime,
    penalty_home: f.penaltyHome,
    penalty_away: f.penaltyAway,
    winner_team_id: resolveTeam(f.winnerTeamExternalId),
    provider: provider.name,
    external_id: f.externalId,
  }));
  if (fixtureRows.length > 0) {
    const { error } = await supabase
      .from("fixture")
      .upsert(fixtureRows, { onConflict: "provider,external_id" });
    if (error) throw error;
  }

  // (Re)score finished fixtures.
  const { data: finished } = await supabase
    .from("fixture")
    .select("id")
    .eq("season_id", season.id)
    .eq("status", "finished");

  let scoredFixtures = 0;
  for (const fixture of finished ?? []) {
    const { error } = await supabase.rpc("score_fixture", { p_fixture: fixture.id });
    if (error) throw error;
    scoredFixtures += 1;
  }

  // Fixtures/teams changed, and any scoring shifted every affected tenant's
  // leaderboard. Invalidate via the shared store so it reaches the server
  // process too (this may run in the standalone `pnpm sync` CLI).
  await invalidateTags("tournament", "leaderboard");

  return {
    provider: provider.name,
    teams: data.teams.length,
    fixtures: fixtureRows.length,
    scoredFixtures,
  };
}
