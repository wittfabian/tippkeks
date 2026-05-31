import {
  DeleteAccountForm,
  DisplayNameForm,
  EmailForm,
  PasswordForm,
} from "@/components/profile/profile-form";
import { requireUser } from "@/lib/auth/membership";
import { createClient } from "@/lib/supabase/server";
import { de } from "@/messages/de";

export const metadata = { title: de.profile.title };

/**
 * Account-wide settings — not tenant-scoped. Lives at /profil (reached from the
 * header icon), since email/password/display name and account deletion belong
 * to the user, not to any one group.
 */
export default async function ProfilePage() {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profile")
    .select("display_name")
    .eq("user_id", user.id)
    .maybeSingle();

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">{de.profile.title}</h1>

      <section className="space-y-2">
        <h2 className="text-muted-foreground text-sm font-medium">{de.profile.displayNameTitle}</h2>
        <div className="rounded-md border p-4">
          <DisplayNameForm displayName={profile?.display_name ?? ""} />
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-muted-foreground text-sm font-medium">{de.profile.emailTitle}</h2>
        <div className="rounded-md border p-4">
          <EmailForm email={user.email ?? ""} />
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-muted-foreground text-sm font-medium">{de.profile.passwordTitle}</h2>
        <div className="rounded-md border p-4">
          <PasswordForm />
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-destructive text-sm font-medium">{de.profile.dangerTitle}</h2>
        <div className="border-destructive/40 rounded-md border p-4">
          <DeleteAccountForm />
        </div>
      </section>
    </div>
  );
}
