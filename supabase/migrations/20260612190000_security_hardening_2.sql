-- Security hardening round 2.
--
-- Closes three gaps found in review:
--   1. The prediction deadline could be bypassed by ANY member via a tenant_id
--      "hop": the admin exemption added in 20260612000000 keyed on the
--      attacker-controlled new.tenant_id, and the prediction UPDATE policy allows
--      moving a row into a tenant the writer just created (create_group makes
--      everyone an admin of their own group and subscribes it to every season).
--      A member could move their own tip into that group, change the score after
--      the result was known, then move it back (the ownership-move exception kept
--      the content untouched on the way back) and get exact-score points.
--   2. Post-kickoff corrections were only audited app-side, so a correction made
--      directly via PostgREST (incl. an admin editing their OWN tip after the
--      result) left no trace.
--   3. The tenant_member INSERT/UPDATE policies let an admin add an arbitrary
--      real account by uuid, or re-point an existing membership to another user —
--      contradicting the "never silently add a stranger" rationale of the merge
--      hardening. Memberships are only ever created by the create_group /
--      redeem_invite definer RPCs and the service-role managed-member path, none
--      of which need a permissive INSERT policy.

-- ---------------------------------------------------------------------------
-- 1. + 2. Deadline trigger: pin tenant_id, key the exemption on the OLD row,
--          and audit every post-kickoff content change at the DB layer.
-- ---------------------------------------------------------------------------

create or replace function public.enforce_prediction_deadline()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_kickoff timestamptz;
  v_is_admin boolean;
begin
  -- A prediction never legitimately moves between tenants — the managed-member
  -- merge only reassigns user_id. Pinning tenant_id closes the "hop" that let a
  -- member launder a row through a tenant they administer to dodge the deadline.
  if tg_op = 'UPDATE' and new.tenant_id is distinct from old.tenant_id then
    raise exception 'Ein Tipp kann nicht in eine andere Gruppe verschoben werden'
      using errcode = 'check_violation';
  end if;

  -- Key the admin exemption on the EXISTING row (old.tenant_id on UPDATE), never
  -- on the attacker-supplied new value.
  v_is_admin := (select private.is_admin(coalesce(old.tenant_id, new.tenant_id)));

  select f.kickoff_at into v_kickoff
  from public.fixture f
  where f.id = new.fixture_id;

  if v_kickoff is null then
    raise exception 'Spiel % existiert nicht', new.fixture_id
      using errcode = 'foreign_key_violation';
  end if;

  -- The deadline protects tip CONTENT, not row ownership: a reassignment that
  -- leaves the scored columns untouched (the managed-member merge) still passes
  -- after kickoff, for anyone.
  if now() >= v_kickoff and (
    tg_op = 'INSERT'
    or new.home_goals is distinct from old.home_goals
    or new.away_goals is distinct from old.away_goals
    or new.advancing_team_id is distinct from old.advancing_team_id
  ) then
    -- Only a tenant admin may change tip content after kickoff (corrections).
    if not v_is_admin then
      raise exception 'Tipp-Deadline überschritten: Anpfiff war %', v_kickoff
        using errcode = 'check_violation';
    end if;

    -- Record the correction at the DB layer so it is auditable even when made
    -- directly via PostgREST (bypassing saveMemberTipsAction). actor_id is the
    -- acting admin; for a service-role write auth.uid() is null, but the service
    -- role is never is_admin, so it cannot reach this branch on a content change.
    insert into public.admin_audit_log (tenant_id, actor_id, action, target_type, target_id, detail)
    values (
      new.tenant_id,
      (select auth.uid()),
      'tip_correction',
      'fixture',
      new.fixture_id::text,
      jsonb_build_object('user_id', new.user_id)
    );
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. tenant_member: drop the broad authenticated INSERT policy and make the
--    (tenant_id, user_id) identity immutable on UPDATE (role still changeable).
-- ---------------------------------------------------------------------------

-- Memberships are created only by SECURITY DEFINER RPCs (create_group,
-- redeem_invite) and the service role (managed members) — all of which bypass
-- RLS — so no permissive INSERT policy is needed. Removing it stops an admin
-- from inserting an arbitrary user_id into their group.
drop policy if exists tenant_member_insert on public.tenant_member;

create or replace function public.tenant_member_identity_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.tenant_id is distinct from old.tenant_id
     or new.user_id is distinct from old.user_id then
    raise exception 'tenant_member identity is immutable'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger tenant_member_identity_immutable
  before update on public.tenant_member
  for each row execute function public.tenant_member_identity_immutable();
