-- Security helpers and integrity triggers.
--
-- Authorization helpers live in a NON-exposed `private` schema and are
-- SECURITY DEFINER + LANGUAGE plpgsql. plpgsql matters: a LANGUAGE sql helper
-- would be inlined at plan time, dropping the definer context and
-- reintroducing "infinite recursion detected in policy" on tenant_member.

create schema if not exists private;

-- Only authenticated users may call the helpers; anon must never reach them.
revoke all on schema private from public;
grant usage on schema private to authenticated;

-- True if the current user is a member of the given tenant.
create or replace function private.is_member(p_tenant uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return exists (
    select 1
    from public.tenant_member tm
    where tm.tenant_id = p_tenant
      and tm.user_id = (select auth.uid())
  );
end;
$$;

-- True if the current user is an admin of the given tenant.
create or replace function private.is_admin(p_tenant uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return exists (
    select 1
    from public.tenant_member tm
    where tm.tenant_id = p_tenant
      and tm.user_id = (select auth.uid())
      and tm.role = 'admin'
  );
end;
$$;

-- True if the current user shares at least one tenant with p_user (used to gate
-- profile visibility to co-members only).
create or replace function private.shares_tenant(p_user uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return exists (
    select 1
    from public.tenant_member me
    join public.tenant_member other on other.tenant_id = me.tenant_id
    where me.user_id = (select auth.uid())
      and other.user_id = p_user
  );
end;
$$;

-- True if the fixture belongs to a season the tenant is subscribed to. Prevents
-- members from predicting fixtures of competitions their group does not play.
create or replace function private.fixture_in_tenant(p_tenant uuid, p_fixture bigint)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return exists (
    select 1
    from public.fixture f
    join public.tenant_season ts on ts.season_id = f.season_id
    where f.id = p_fixture
      and ts.tenant_id = p_tenant
  );
end;
$$;

revoke all on function
  private.is_member(uuid),
  private.is_admin(uuid),
  private.shares_tenant(uuid),
  private.fixture_in_tenant(uuid, bigint)
from public, anon;

grant execute on function
  private.is_member(uuid),
  private.is_admin(uuid),
  private.shares_tenant(uuid),
  private.fixture_in_tenant(uuid, bigint)
to authenticated;

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger fixture_set_updated_at
  before update on public.fixture
  for each row execute function public.set_updated_at();

create trigger profile_set_updated_at
  before update on public.profile
  for each row execute function public.set_updated_at();

create trigger prediction_set_updated_at
  before update on public.prediction
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Deadline lock: predictions cannot be created or changed at/after kickoff.
-- Uses the DB clock (immune to client tampering) and fires for every writer.
-- ---------------------------------------------------------------------------

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

  if now() >= v_kickoff then
    raise exception 'Tipp-Deadline überschritten: Anpfiff war %', v_kickoff
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger prediction_enforce_deadline
  before insert or update on public.prediction
  for each row execute function public.enforce_prediction_deadline();

-- ---------------------------------------------------------------------------
-- Every tenant must keep at least one admin.
-- ---------------------------------------------------------------------------

create or replace function public.enforce_min_one_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant uuid := coalesce(old.tenant_id, new.tenant_id);
  v_admins integer;
begin
  -- Skip when the tenant itself is being deleted (its members cascade away);
  -- the invariant only matters while the tenant still exists.
  if not exists (select 1 from public.tenant t where t.id = v_tenant) then
    return null;
  end if;

  select count(*) into v_admins
  from public.tenant_member tm
  where tm.tenant_id = v_tenant
    and tm.role = 'admin';

  if v_admins = 0 then
    raise exception 'Eine Gruppe muss mindestens einen Admin behalten'
      using errcode = 'check_violation';
  end if;

  return null;
end;
$$;

create trigger tenant_member_min_one_admin
  after update or delete on public.tenant_member
  for each row execute function public.enforce_min_one_admin();

-- ---------------------------------------------------------------------------
-- Provision a profile row whenever an auth user is created.
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profile (user_id, display_name)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
      split_part(new.email, '@', 1)
    )
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Keep trigger functions off the PostgREST RPC surface.
--
-- CREATE FUNCTION grants EXECUTE to PUBLIC by default, which lets PostgREST
-- expose these as /rest/v1/rpc/<name> to the anon/authenticated roles. They are
-- only ever meant to fire as triggers, and EXECUTE on a trigger function is
-- checked at CREATE TRIGGER time, not when the trigger fires — so revoking it
-- does NOT break the triggers, it just removes them from the callable API
-- (clearing the anon_/authenticated_security_definer_function_executable lints).
-- The three SECURITY DEFINER ones would otherwise run with owner rights and
-- bypass RLS; set_updated_at is INVOKER but equally has no business as an RPC.
revoke all on function public.enforce_prediction_deadline() from public, anon, authenticated;
revoke all on function public.enforce_min_one_admin() from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.set_updated_at() from public, anon, authenticated;
