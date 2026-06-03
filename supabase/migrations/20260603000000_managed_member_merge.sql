-- ===========================================================================
-- Managed-member conversion: collision detection + merge into existing account
-- ===========================================================================
--
-- The convert flow assumed the assigned email was new (the placeholder's stable
-- user_id simply gains the email, keeping its tip history). When the email
-- already belongs to a separate real account that path collides — there are two
-- user_ids, and a tip's identity is (tenant_id, user_id, fixture_id). This
-- migration adds (1) deterministic collision detection and (2) a MERGE that moves
-- the placeholder's tips in a group onto the existing account and deletes it.

-- 1 — Detect an email collision deterministically -----------------------------
--
-- On sign-up/create GoTrue maps a duplicate to the friendly `email_exists` code,
-- but on the updateUserById UPDATE path it surfaces the raw auth.users unique
-- violation as `unexpected_failure` (HTTP 500) — indistinct from a genuine fault.
-- So convertManagedMemberAction pre-checks here and reacts cleanly.
--
-- SECURITY DEFINER to read auth.users; service_role only (the convert action runs
-- as service_role). Deliberately NOT granted to authenticated/anon: an arbitrary
-- email-existence probe is an account-enumeration vector. Case-insensitive to
-- match GoTrue's own uniqueness semantics.
create or replace function public.email_in_use(p_email text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from auth.users where lower(email) = lower(p_email)
  );
$$;

revoke all on function public.email_in_use(text) from public, anon, authenticated;
grant execute on function public.email_in_use(text) to service_role;

-- 2 — Deadline trigger: block late CONTENT changes, allow ownership moves ------
--
-- Unchanged for INSERT (always blocked at/after kickoff) and for any UPDATE that
-- touches the scored columns. A reassignment that leaves home_goals/away_goals/
-- advancing_team_id untouched now passes after kickoff, which the merge needs —
-- the deadline protects tip CONTENT, not row ownership. (Avoids needing superuser
-- to suspend triggers, which the platform `postgres` role lacks.)
create or replace function public.enforce_prediction_deadline()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_kickoff timestamptz;
begin
  select f.kickoff_at into v_kickoff
  from public.fixture f
  where f.id = new.fixture_id;

  if v_kickoff is null then
    raise exception 'Spiel % existiert nicht', new.fixture_id
      using errcode = 'foreign_key_violation';
  end if;

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

-- 3 — The merge itself ---------------------------------------------------------
--
-- p_managed_user is the placeholder being converted; p_target_email resolves the
-- existing real account it merges into. Conflict policy: the managed (admin-
-- entered) tip wins — the target's own tip for a shared fixture is dropped first,
-- then the managed rows are moved over. prediction_score follows its prediction
-- by FK; moved scores keep their computed points, now owned by the target.
-- Managed members belong to exactly one group, so the placeholder auth user is
-- deleted at the end (cascading its profile + now-empty membership).
--
-- SECURITY DEFINER (touches auth.users + bypasses RLS); service_role only — it is
-- driven by convertManagedMemberAction after a server-side admin check, the same
-- trust boundary as the result-override and managed-create paths.
create or replace function public.merge_managed_member(
  p_tenant uuid,
  p_managed_user uuid,
  p_target_email text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target uuid;
  v_managed boolean;
begin
  select id into v_target from auth.users where lower(email) = lower(p_target_email);
  if v_target is null then
    raise exception 'Kein Konto mit dieser E-Mail-Adresse' using errcode = 'no_data_found';
  end if;
  if v_target = p_managed_user then
    raise exception 'Quelle und Ziel sind identisch' using errcode = 'check_violation';
  end if;

  select managed into v_managed from public.profile where user_id = p_managed_user;
  if v_managed is not true then
    raise exception 'Quelle ist kein verwaltetes Mitglied' using errcode = 'check_violation';
  end if;
  if not exists (
    select 1 from public.tenant_member
    where tenant_id = p_tenant and user_id = p_managed_user
  ) then
    raise exception 'Verwaltetes Mitglied gehört nicht zu dieser Gruppe'
      using errcode = 'check_violation';
  end if;

  -- Target joins the group if not already in it (existing role is preserved).
  insert into public.tenant_member (tenant_id, user_id, role)
  values (p_tenant, v_target, 'member')
  on conflict (tenant_id, user_id) do nothing;

  -- Conflict policy "managed wins": drop the target's own prediction for any
  -- fixture the placeholder also tipped (its score cascades), so the subsequent
  -- ownership move cannot hit the (tenant, user, fixture) unique constraint.
  delete from public.prediction tgt
  where tgt.tenant_id = p_tenant
    and tgt.user_id = v_target
    and exists (
      select 1 from public.prediction src
      where src.tenant_id = p_tenant
        and src.user_id = p_managed_user
        and src.fixture_id = tgt.fixture_id
    );

  -- Reassign ownership. Allowed past kickoff because content is untouched (the
  -- refined deadline trigger only blocks late content changes).
  update public.prediction
    set user_id = v_target
  where tenant_id = p_tenant and user_id = p_managed_user;

  update public.prediction_score
    set user_id = v_target
  where tenant_id = p_tenant and user_id = p_managed_user;

  -- The placeholder no longer owns anything; remove the synthetic account. FKs
  -- cascade its profile and its (now tip-free) membership row.
  delete from auth.users where id = p_managed_user;
end;
$$;

revoke all on function public.merge_managed_member(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.merge_managed_member(uuid, uuid, text) to service_role;
