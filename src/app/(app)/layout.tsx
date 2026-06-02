import { Settings, User } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { signOutAction } from "@/actions/auth";
import { Wordmark } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Button, buttonVariants } from "@/components/ui/button";
import { isSiteAdmin, requireUser } from "@/lib/auth/membership";
import { createClient } from "@/lib/supabase/server";
import { de } from "@/messages/de";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireUser(); // redirects to /login when unauthenticated
  const supabase = await createClient();

  // MFA gate: a user with a verified second factor whose session is still aal1
  // must pass the /mfa challenge before reaching any app page. Users without a
  // factor have nextLevel === "aal1" and pass straight through.
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel === "aal1" && aal.nextLevel === "aal2") redirect("/mfa");

  const siteAdmin = await isSiteAdmin(supabase);

  return (
    <div className="flex min-h-full flex-col">
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
          <Link href="/info" className="hover:text-foreground transition">
            {de.legal.footerNav.info}
          </Link>
          <span aria-hidden>·</span>
          <Link href="/privacy" className="hover:text-foreground transition">
            {de.legal.footerNav.privacy}
          </Link>
          <span aria-hidden>·</span>
          <Link href="/imprint" className="hover:text-foreground transition">
            {de.legal.footerNav.impressum}
          </Link>
          <span aria-hidden>·</span>
          <span>{de.common.poweredBy}</span>
        </div>
      </footer>
    </div>
  );
}
