import { ProfileForm } from "@/components/profile/profile-form";
import { requireMembership } from "@/lib/auth/membership";
import { de } from "@/messages/de";

export const metadata = { title: de.profile.title };

export default async function ProfilePage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await params;
  const membership = await requireMembership(tenantSlug);

  const { data: profile } = await membership.supabase
    .from("profile")
    .select("display_name")
    .eq("user_id", membership.userId)
    .maybeSingle();

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">{de.profile.title}</h2>
      <ProfileForm slug={tenantSlug} displayName={profile?.display_name ?? ""} />
    </div>
  );
}
