-- Admin tip corrections after kickoff.
--
-- Until now the prediction deadline trigger fired for every writer, so an admin
-- could not fix a mis-typed score once a match had started. Admins are trusted
-- to enter tips for any member (managed members, latecomers), and mistakes
-- happen — they must be able to correct a tip after kickoff and have the
-- leaderboard catch up immediately.
--
-- Three changes:
--   1. The deadline trigger now lets tenant admins write at any time (members
--      tipping for themselves are still held to the kickoff via the DB clock).
--   2. A new AFTER trigger re-scores a fixture whenever a prediction on an
--      already-FINISHED fixture changes, so a correction updates the stored
--      score + leaderboard without waiting for the next sync.
--   3. A new audit action records post-kickoff corrections (logged app-side).

-- ---------------------------------------------------------------------------
-- 1. Deadline lock now exempts tenant admins.
-- ---------------------------------------------------------------------------

-- Combines the admin exemption (new) with the ownership-move exception added in
-- 20260603000000 (the managed-member merge reassigns user_id on past fixtures);
-- both must survive here since this is now the live definition.
create or replace function public.enforce_prediction_deadline()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_kickoff timestamptz;
begin
  -- Tenant admins may enter or correct tips at any time (e.g. fixing a score
  -- they mistyped for a member after kickoff). The deadline only binds members
  -- tipping for themselves; the RLS write policies already gate WHO may write.
  if (select private.is_admin(new.tenant_id)) then
    return new;
  end if;

  select f.kickoff_at into v_kickoff
  from public.fixture f
  where f.id = new.fixture_id;

  if v_kickoff is null then
    raise exception 'Spiel % existiert nicht', new.fixture_id
      using errcode = 'foreign_key_violation';
  end if;

  -- The deadline protects tip CONTENT, not row ownership: a reassignment that
  -- leaves the scored columns untouched (the managed-member merge) still passes
  -- after kickoff.
  if now() >= v_kickoff and (
    tg_op = 'INSERT'
    or new.home_goals is distinct from old.home_goals
    or new.away_goals is distinct from old.away_goals
    or new.advancing_team_id is distinct from old.advancing_team_id
  ) then
    raise exception 'Tipp-Deadline überschritten: Anpfiff war %', v_kickoff
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Keep stored scores fresh when a tip on an already-finished fixture changes.
-- Normal pre-kickoff tipping never touches a finished fixture, so this is a
-- no-op on the hot path (a single PK lookup). It exists for admin corrections:
-- after an admin fixes a tip on a played match, prediction_score and the
-- leaderboard must reflect it at once. SECURITY DEFINER so it may call
-- score_fixture (service_role only); writes prediction_score, not prediction,
-- so it cannot recurse with the prediction triggers.
-- ---------------------------------------------------------------------------

create or replace function public.rescore_finished_on_prediction_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.fixture_status;
begin
  select f.status into v_status
  from public.fixture f
  where f.id = new.fixture_id;

  if v_status = 'finished' then
    perform public.score_fixture(new.fixture_id);
  end if;

  return null; -- AFTER trigger: the return value is ignored
end;
$$;

revoke all on function public.rescore_finished_on_prediction_change()
  from public, anon, authenticated;

create trigger prediction_rescore_finished
  after insert or update on public.prediction
  for each row execute function public.rescore_finished_on_prediction_change();

-- ---------------------------------------------------------------------------
-- 3. Audit action for post-kickoff corrections (the insert happens app-side in
-- saveMemberTipsAction, under the existing admin_audit_log RLS).
-- ---------------------------------------------------------------------------

alter type public.audit_action add value if not exists 'tip_correction';
