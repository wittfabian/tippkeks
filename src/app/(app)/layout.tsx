import { Settings, User } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { signOutAction } from "@/actions/auth";
import { Wordmark } from "@/components/brand/logo";
import { LegalFooterNav } from "@/components/legal/legal-footer-nav";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Button, buttonVariants } from "@/components/ui/button";
import { isSiteAdmin } from "@/lib/auth/membership";
import { createClient } from "@/lib/supabase/server";
import { de } from "@/messages/de";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();

  // Authenticate against the Auth server with getUser() (not getSession): this
  // verifies the session server-side and silences supabase-js's "insecure user
  // object" warning that getAuthenticatorAssuranceLevel()'s internal getSession()
  // would otherwise emit on a fresh per-request client.
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  // MFA gate (UX layer; the Postgres MFA policies are the authoritative gate): a
  // user with a verified second factor whose session is not yet aal2 must pass the
  // /mfa challenge first. Users without a factor have nextLevel "aal1" and pass through.
  //
  // Redirect on ANY pending step-up (nextLevel "aal2" while currentLevel is not
  // "aal2") — not only currentLevel === "aal1". An access token can omit the `aal`
  // claim, leaving currentLevel null; a strict "=== aal1" check would let such a
  // session into the app while private.mfa_satisfied() (which sees aal IS NOT
  // 'aal2') denies every personal/tenant read — silently blanking the profile,
  // the site-admin nav, and blocking the account-deletion RPC.
  // AAL and the site-admin check are independent, so fetch them together. (When a
  // step-up is pending the siteAdmin result is discarded by the redirect below —
  // a rare path, worth one fewer round-trip on every other request.)
  const [{ data: aal }, siteAdmin] = await Promise.all([
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    isSiteAdmin(supabase),
  ]);
  if (aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2") redirect("/mfa");

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="bg-background/80 sticky top-0 z-30 border-b backdrop-blur">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/groups" aria-label={de.app.name}>
            <Wordmark />
          </Link>
          <div className="flex items-center gap-1">
            <Link
              href="/profile"
              aria-label={de.nav.profile}
              title={de.nav.profile}
              className={buttonVariants({ variant: "ghost", size: "icon" })}
            >
              <User className="size-4" />
            </Link>
            {siteAdmin && (
              <Link
                href="/settings"
                aria-label={de.settings.title}
                title={de.settings.title}
                className={buttonVariants({ variant: "ghost", size: "icon" })}
              >
                <Settings className="size-4" />
              </Link>
            )}
            <ThemeToggle />
            <form action={signOutAction}>
              <Button type="submit" variant="ghost" size="sm">
                {de.nav.signOut}
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">{children}</main>
      <footer className="text-muted-foreground border-t">
        <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-center gap-x-4 gap-y-1 px-4 py-3 text-center text-xs">
          <LegalFooterNav trailing={<span>{de.common.poweredBy}</span>} />
        </div>
      </footer>
    </div>
  );
}
