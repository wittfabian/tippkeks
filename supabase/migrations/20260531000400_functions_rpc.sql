-- Scoring engine, tenant lifecycle RPCs, recompute and the leaderboard view.

-- ---------------------------------------------------------------------------
-- Scoring engine (server-authoritative, configurable, pure)
-- ---------------------------------------------------------------------------

-- Result of scoring one prediction against a regulation result.
create type public.score_outcome as (points integer, category public.score_category);

-- Pure function: given a prediction, the regulation (90') result, the stage and
-- a rule-set config, return points + how it matched. Mirrored 1:1 in TypeScript
-- (src/lib/scoring) for unit tests and the in-form "you'd get N points" preview.
-- Knockout matches are scored on the regulation result; the advancing-team
-- bonus uses the actual winner (post extra-time/penalties).
create or replace function public.score_prediction(
  p_home integer,
  p_away integer,
  p_advancing bigint,
  f_home integer,
  f_away integer,
  f_winner bigint,
  p_stage public.stage_kind,
  p_config jsonb
)
returns public.score_outcome
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_pdiff integer;
  v_fdiff integer;
  v_base integer;
  v_cat public.score_category;
  v_mult numeric;
  v_points integer;
begin
  if p_home is null or p_away is null or f_home is null or f_away is null then
    return (0, 'miss')::public.score_outcome;
  end if;

  v_pdiff := p_home - p_away;
  v_fdiff := f_home - f_away;

  if p_home = f_home and p_away = f_away then
    v_cat := 'exact';
    v_base := coalesce((p_config ->> 'exact')::integer, 0);
  elsif v_pdiff = v_fdiff then
    v_cat := 'goal_diff';
    v_base := coalesce((p_config ->> 'goal_diff')::integer, 0);
  elsif sign(v_pdiff) = sign(v_fdiff) then
    v_cat := 'tendency';
    v_base := coalesce((p_config ->> 'tendency')::integer, 0);
  else
    v_cat := 'miss';
    v_base := 0;
  end if;

  v_mult := coalesce((p_config -> 'stage_multipliers' ->> p_stage::text)::numeric, 1);
  v_points := floor(v_base * v_mult)::integer;

  -- Advancing-team bonus (knockout only): predicted advancing team == winner.
  if p_advancing is not null and f_winner is not null and p_advancing = f_winner then
    v_points := v_points + coalesce((p_config ->> 'advance_bonus')::integer, 0);
  end if;

  return (v_points, v_cat)::public.score_outcome;
end;
$$;

revoke all on function
  public.score_prediction(integer, integer, bigint, integer, integer, bigint, public.stage_kind, jsonb)
from public;
grant execute on function
  public.score_prediction(integer, integer, bigint, integer, integer, bigint, public.stage_kind, jsonb)
to authenticated, service_role;

-- Recompute and persist scores for every prediction on a fixture, each against
-- its own tenant's active rule set. Idempotent: re-running after a corrected
-- result simply overwrites. A non-finished / result-less fixture clears scores
-- (postponed/abandoned excluded, not zeroed). SECURITY DEFINER + service_role
-- only — the client can never influence points.
create or replace function public.score_fixture(p_fixture bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fixture public.fixture;
  v_stage public.stage_kind;
  v_rule public.scoring_rule_set;
  v_pred public.prediction;
  v_outcome public.score_outcome;
begin
  select * into v_fixture from public.fixture where id = p_fixture;
  if not found then
    raise exception 'Spiel % nicht gefunden', p_fixture using errcode = 'no_data_found';
  end if;

  if v_fixture.status <> 'finished'
     or v_fixture.regular_home is null
     or v_fixture.regular_away is null then
    delete from public.prediction_score where fixture_id = p_fixture;
    return;
  end if;

  select coalesce(s.kind, 'other')
    into v_stage
  from public.fixture f
  left join public.stage s on s.id = f.stage_id
  where f.id = p_fixture;

  for v_pred in
    select * from public.prediction where fixture_id = p_fixture
  loop
    select * into v_rule
    from public.scoring_rule_set
    where tenant_id = v_pred.tenant_id and is_active
    limit 1;

    if not found then
      delete from public.prediction_score where prediction_id = v_pred.id;
      continue;
    end if;

    v_outcome := public.score_prediction(
      v_pred.home_goals, v_pred.away_goals, v_pred.advancing_team_id,
      v_fixture.regular_home, v_fixture.regular_away, v_fixture.winner_team_id,
      v_stage, v_rule.config
    );

    insert into public.prediction_score
      (prediction_id, tenant_id, user_id, fixture_id, rule_set_id, points, category, computed_at)
    values
      (v_pred.id, v_pred.tenant_id, v_pred.user_id, p_fixture, v_rule.id,
       v_outcome.points, v_outcome.category, now())
    on conflict (prediction_id) do update set
      rule_set_id = excluded.rule_set_id,
      points = excluded.points,
      category = excluded.category,
      computed_at = excluded.computed_at;
  end loop;
end;
$$;

revoke all on function public.score_fixture(bigint) from public, anon, authenticated;
grant execute on function public.score_fixture(bigint) to service_role;

-- Admin-triggered full recompute for a tenant (e.g. after a rule change).
-- SECURITY DEFINER so it may call score_fixture; re-checks admin via auth.uid().
create or replace function public.recompute_tenant(p_tenant uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fixture_id bigint;
begin
  if not private.is_admin(p_tenant) then
    raise exception 'Nur Admins dürfen Punkte neu berechnen'
      using errcode = 'insufficient_privilege';
  end if;

  for v_fixture_id in
    select f.id
    from public.fixture f
    join public.tenant_season ts on ts.season_id = f.season_id
    where ts.tenant_id = p_tenant and f.status = 'finished'
  loop
    perform public.score_fixture(v_fixture_id);
  end loop;

  insert into public.admin_audit_log (tenant_id, actor_id, action)
  values (p_tenant, (select auth.uid()), 'ruleset_change');
end;
$$;

revoke all on function public.recompute_tenant(uuid) from public, anon;
grant execute on function public.recompute_tenant(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Tenant lifecycle RPCs (definer: solve the membership chicken-and-egg)
-- ---------------------------------------------------------------------------

-- Create a tenant, make the caller its admin, seed a default rule set and
-- subscribe it to every seeded season (v1: only WC2026 exists).
create or replace function public.create_group(p_name text, p_slug text)
returns public.tenant
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_tenant public.tenant;
begin
  if v_uid is null then
    raise exception 'Nicht angemeldet' using errcode = 'insufficient_privilege';
  end if;

  insert into public.tenant (name, slug, created_by)
  values (p_name, lower(p_slug), v_uid)
  returning * into v_tenant;

  insert into public.tenant_member (tenant_id, user_id, role)
  values (v_tenant.id, v_uid, 'admin');

  insert into public.scoring_rule_set (tenant_id, version, config, is_active)
  values (
    v_tenant.id,
    1,
    '{"exact": 4, "goal_diff": 3, "tendency": 2, "advance_bonus": 2, "stage_multipliers": {}}'::jsonb,
    true
  );

  insert into public.tenant_season (tenant_id, season_id)
  select v_tenant.id, s.id from public.season s;

  insert into public.admin_audit_log (tenant_id, actor_id, action, target_type, target_id)
  values (v_tenant.id, v_uid, 'tenant_create', 'tenant', v_tenant.id::text);

  return v_tenant;
end;
$$;

revoke all on function public.create_group(text, text) from public, anon;
grant execute on function public.create_group(text, text) to authenticated;

-- Redeem an invite code: validate, add the caller as a member, count the use.
create or replace function public.redeem_invite(p_code text)
returns public.tenant
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_invite public.tenant_invite;
  v_tenant public.tenant;
begin
  if v_uid is null then
    raise exception 'Nicht angemeldet' using errcode = 'insufficient_privilege';
  end if;

  select * into v_invite from public.tenant_invite where code = p_code;
  if not found then
    raise exception 'Ungültiger Einladungscode' using errcode = 'no_data_found';
  end if;
  if v_invite.expires_at is not null and v_invite.expires_at <= now() then
    raise exception 'Einladungscode ist abgelaufen' using errcode = 'check_violation';
  end if;
  if v_invite.max_uses is not null and v_invite.used_count >= v_invite.max_uses then
    raise exception 'Einladungscode ist aufgebraucht' using errcode = 'check_violation';
  end if;

  insert into public.tenant_member (tenant_id, user_id, role)
  values (v_invite.tenant_id, v_uid, v_invite.role)
  on conflict (tenant_id, user_id) do nothing;

  -- Only count a use when a membership was actually created.
  if found then
    update public.tenant_invite set used_count = used_count + 1 where id = v_invite.id;
    insert into public.admin_audit_log (tenant_id, actor_id, action, target_type, target_id)
    values (v_invite.tenant_id, v_uid, 'invite_redeem', 'user', v_uid::text);
  end if;

  select * into v_tenant from public.tenant where id = v_invite.tenant_id;
  return v_tenant;
end;
$$;

revoke all on function public.redeem_invite(text) from public, anon;
grant execute on function public.redeem_invite(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Leaderboard (security_invoker: the caller's RLS decides what they can see)
-- ---------------------------------------------------------------------------

create view public.leaderboard
with (security_invoker = true) as
select
  ps.tenant_id,
  ps.user_id,
  pr_profile.display_name,
  sum(ps.points)::integer as total_points,
  count(*) filter (where ps.category = 'exact')::integer as exact_count,
  count(*) filter (where ps.category in ('exact', 'goal_diff', 'tendency'))::integer as hit_count,
  max(pred.updated_at) as last_prediction_at,
  rank() over (
    partition by ps.tenant_id
    order by
      sum(ps.points) desc,
      count(*) filter (where ps.category = 'exact') desc,
      count(*) filter (where ps.category in ('exact', 'goal_diff', 'tendency')) desc,
      max(pred.updated_at) asc
  )::integer as rank
from public.prediction_score ps
join public.profile pr_profile on pr_profile.user_id = ps.user_id
join public.prediction pred on pred.id = ps.prediction_id
group by ps.tenant_id, ps.user_id, pr_profile.display_name;

grant select on public.leaderboard to authenticated;
