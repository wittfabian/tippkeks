import { Settings } from "lucide-react";
import Link from "next/link";

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
  const siteAdmin = await isSiteAdmin(supabase);

  return (
    <div className="flex min-h-full flex-col">
      <header className="bg-background/80 sticky top-0 z-30 border-b backdrop-blur">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/gruppen" aria-label={de.app.name}>
            <Wordmark />
          </Link>
          <div className="flex items-center gap-1">
            {siteAdmin && (
              <Link
                href="/einstellungen"
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
      <footer className="text-muted-foreground border-t px-4 py-3 text-center text-xs">
        {de.common.poweredBy}
      </footer>
    </div>
  );
}
