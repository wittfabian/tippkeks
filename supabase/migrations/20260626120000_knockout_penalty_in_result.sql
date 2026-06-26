-- Knockout scoring rule change (product decision, 2026-06-26): the penalty
-- shoot-out now counts FOR the result-tip. The scored result is the
-- after-extra-time scoreline with the shoot-out goals added on top
-- (e.g. 1:1 a.e.t., 4:3 on penalties -> scored as 5:4). This reverses the
-- earlier "shoot-out does not count for the score" convention; the shoot-out
-- still independently drives the advancing-team bonus via winner_team_id.
--
-- Implemented as two extra penalty parameters on score_prediction (the single
-- source of truth) so every caller folds them in identically; the TS mirror in
-- src/lib/scoring/engine.ts matches. regular_home/away keep storing the a.e.t.
-- score unchanged; the addition happens at scoring time only.

drop function if exists
  public.score_prediction(integer, integer, uuid, integer, integer, uuid, public.stage_kind, jsonb);

create or replace function public.score_prediction(
  p_home integer,
  p_away integer,
  p_advancing uuid,
  f_home integer,
  f_away integer,
  f_pen_home integer,
  f_pen_away integer,
  f_winner uuid,
  p_stage public.stage_kind,
  p_config jsonb
)
returns public.score_outcome
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_eff_home integer;
  v_eff_away integer;
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

  -- Penalty shoot-out goals count for the result (added to the a.e.t. score).
  v_eff_home := f_home + coalesce(f_pen_home, 0);
  v_eff_away := f_away + coalesce(f_pen_away, 0);

  v_pdiff := p_home - p_away;
  v_fdiff := v_eff_home - v_eff_away;

  if p_home = v_eff_home and p_away = v_eff_away then
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
  public.score_prediction(integer, integer, uuid, integer, integer, integer, integer, uuid, public.stage_kind, jsonb)
from public;
grant execute on function
  public.score_prediction(integer, integer, uuid, integer, integer, integer, integer, uuid, public.stage_kind, jsonb)
to authenticated, service_role;

-- Re-create score_fixture so it passes the stored shoot-out goals through.
create or replace function public.score_fixture(p_fixture uuid)
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
      v_fixture.regular_home, v_fixture.regular_away,
      v_fixture.penalty_home, v_fixture.penalty_away, v_fixture.winner_team_id,
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
