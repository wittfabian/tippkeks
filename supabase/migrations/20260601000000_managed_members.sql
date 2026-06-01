-- Managed members ----------------------------------------------------------
--
-- A "managed member" is a participant an admin creates and tips for, who never
-- logs in (and may have no real email of their own) — the common case where one
-- person runs the group and nobody else touches the platform.
--
-- Rather than decoupling participation from auth.users (which would touch every
-- table, RLS policy and the scoring SQL), a managed member is modelled as an
-- ordinary auth user created server-side via the Admin API with a synthetic,
-- non-deliverable email and NO password — so they cannot sign in, and no mail is
-- ever sent to them. The existing membership / prediction / scoring / leaderboard
-- machinery (incl. the "admin writes predictions for any member" RLS policy)
-- then applies completely unchanged.
--
-- This flag only lets the UI label them as "verwaltet" and offer the upgrade
-- path (admin assigns a real email later → the person gets an invite and takes
-- over their existing tip history, since user_id is stable). Creation and the
-- managed flag are written by the service role after a server-side admin check
-- (same trust model as the result-override action); there is deliberately no
-- self-service path, so no INSERT/UPDATE policy grants it to end users.

-- New audit actions for the managed-member lifecycle. (ADD VALUE is allowed in
-- a transaction as long as the value is not used in the same one — it isn't
-- here; only the app writes these rows.)
alter type public.audit_action add value if not exists 'member_create_managed';
alter type public.audit_action add value if not exists 'member_convert_managed';

alter table public.profile
  add column managed boolean not null default false;

comment on column public.profile.managed is
  'True for an admin-created member who cannot sign in (synthetic email, no '
  'password). Set by the service role on creation; cleared when the member is '
  'converted to a real login account.';
