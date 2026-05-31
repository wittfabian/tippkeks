import {
  DeleteAccountForm,
  DisplayNameForm,
  EmailForm,
  PasswordForm,
} from "@/components/profile/profile-form";
import { requireMembership } from "@/lib/auth/membership";
import { de } from "@/messages/de";

export const metadata = { title: de.profile.title };

export default async function ProfilePage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await params;
  const membership = await requireMembership(tenantSlug);

  const [{ data: profile }, { data: claims }] = await Promise.all([
    membership.supabase
      .from("profile")
      .select("display_name")
      .eq("user_id", membership.userId)
      .maybeSingle(),
    membership.supabase.auth.getClaims(),
  ]);
  const email = (claims?.claims?.email as string | undefined) ?? "";

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">{de.profile.title}</h2>

      <section className="space-y-2">
        <h3 className="text-muted-foreground text-sm font-medium">{de.profile.displayNameTitle}</h3>
        <div className="rounded-md border p-4">
          <DisplayNameForm slug={tenantSlug} displayName={profile?.display_name ?? ""} />
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="text-muted-foreground text-sm font-medium">{de.profile.emailTitle}</h3>
        <div className="rounded-md border p-4">
          <EmailForm email={email} />
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="text-muted-foreground text-sm font-medium">{de.profile.passwordTitle}</h3>
        <div className="rounded-md border p-4">
          <PasswordForm />
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="text-destructive text-sm font-medium">{de.profile.dangerTitle}</h3>
        <div className="border-destructive/40 rounded-md border p-4">
          <DeleteAccountForm />
        </div>
      </section>
    </div>
  );
}
