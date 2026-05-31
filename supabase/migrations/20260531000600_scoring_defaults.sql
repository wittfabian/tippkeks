-- Adjust the default scoring rules to the agreed scheme:
--   tendency (correct winner/outcome)            = 1
--   goal_diff (correct margin, incl. a draw)      = 2
--   exact     (exact final score)                 = 3
-- The scoring engine already distinguishes these categories (a correct draw is
-- a goal_diff match, since both sides have margin 0); only the point values
-- change. advance_bonus (knockout) is left at 2.

-- New groups get the new defaults. Body otherwise matches migration 500
-- (the group-creation toggle check must be preserved on create-or-replace).
create or replace function public.create_group(p_name text, p_slug text)
returns public.tenant
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_tenant public.tenant;
  v_creation_enabled boolean;
begin
  if v_uid is null then
    raise exception 'Nicht angemeldet' using errcode = 'insufficient_privilege';
  end if;

  if not private.is_site_admin() then
    select coalesce((value ->> 'enabled')::boolean, true)
      into v_creation_enabled
      from public.app_setting
      where key = 'group_creation_enabled';
    if v_creation_enabled is not null and not v_creation_enabled then
      raise exception 'Gruppen-Erstellung ist deaktiviert'
        using errcode = 'insufficient_privilege';
    end if;
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
    '{"exact": 3, "goal_diff": 2, "tendency": 1, "advance_bonus": 2, "stage_multipliers": {}}'::jsonb,
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

-- One-time data fix: bring existing groups that are still on the OLD defaults
-- (4/3/2) onto the new scheme, preserving any advance_bonus / stage_multipliers,
-- then re-score every finished fixture so stored points reflect the change.
-- Groups whose admins customised their rules are left untouched.
do $$
declare
  v_fixture_id bigint;
begin
  update public.scoring_rule_set
  set config = config || '{"exact": 3, "goal_diff": 2, "tendency": 1}'::jsonb
  where is_active
    and (config ->> 'exact')::int = 4
    and (config ->> 'goal_diff')::int = 3
    and (config ->> 'tendency')::int = 2;

  for v_fixture_id in select id from public.fixture where status = 'finished' loop
    perform public.score_fixture(v_fixture_id);
  end loop;
end $$;
