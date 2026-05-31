import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

export type MemberRole = Database["public"]["Enums"]["member_role"];

export type CurrentUser = {
  id: string;
  email: string | null;
};

/** The signed-in user, or null. Reads validated JWT claims (never getSession). */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  return { id: claims.sub, email: (claims.email as string | undefined) ?? null };
}

/** Like getCurrentUser but redirects to /login when unauthenticated. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export type Membership = {
  tenantId: string;
  tenantName: string;
  slug: string;
  role: MemberRole;
  userId: string;
  /** Whether members may submit their own predictions (admins always may). */
  memberTippingEnabled: boolean;
  /** The cookie-aware client, reused so callers avoid creating another. */
  supabase: Awaited<ReturnType<typeof createClient>>;
};

/**
 * Resolve the current user's membership of the tenant identified by `slug`.
 * Redirects to /login when unauthenticated and 404s when the tenant does not
 * exist or the user is not a member (RLS already hides non-member tenants).
 */
export async function requireMembership(slug: string): Promise<Membership> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect("/login");

  const { data: tenant } = await supabase
    .from("tenant")
    .select("id, name, slug, member_tipping_enabled")
    .eq("slug", slug)
    .maybeSingle();
  if (!tenant) notFound();

  const { data: member } = await supabase
    .from("tenant_member")
    .select("role")
    .eq("tenant_id", tenant.id)
    .eq("user_id", userId)
    .maybeSingle();
  if (!member) notFound();

  return {
    tenantId: tenant.id,
    tenantName: tenant.name,
    slug: tenant.slug,
    role: member.role,
    userId,
    memberTippingEnabled: tenant.member_tipping_enabled,
    supabase,
  };
}

/** Require admin role for a tenant; 404s for non-admins. */
export async function requireAdmin(slug: string): Promise<Membership> {
  const membership = await requireMembership(slug);
  if (membership.role !== "admin") notFound();
  return membership;
}

/**
 * True if the current user is a site admin (operator of the whole installation).
 * RLS lets a user read only their own site_admin row, so this is the user's own
 * answer to "am I a site admin?". Site admins are provisioned out-of-band via
 * scripts/set-site-admin.ts, never self-service.
 */
export async function isSiteAdmin(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<boolean> {
  const { data } = await supabase.from("site_admin").select("user_id").limit(1).maybeSingle();
  return Boolean(data);
}

export type SiteAdmin = {
  userId: string;
  supabase: Awaited<ReturnType<typeof createClient>>;
};

/** Require site-admin rights; redirects unauthenticated, 404s non-site-admins. */
export async function requireSiteAdmin(): Promise<SiteAdmin> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect("/login");
  if (!(await isSiteAdmin(supabase))) notFound();
  return { userId, supabase };
}
