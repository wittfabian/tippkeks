import Link from "next/link";

import { signOutAction } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/membership";
import { de } from "@/messages/de";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireUser();

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/" className="font-semibold">
            {de.app.name}
          </Link>
          <form action={signOutAction}>
            <Button type="submit" variant="ghost" size="sm">
              {de.nav.signOut}
            </Button>
          </form>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">{children}</main>
      <footer className="text-muted-foreground border-t px-4 py-3 text-center text-xs">
        {de.common.poweredBy}
      </footer>
    </div>
  );
}
