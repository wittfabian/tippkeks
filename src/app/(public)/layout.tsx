import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/membership";
import { de } from "@/messages/de";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  // Signed-in users have no business on login/register.
  const user = await getCurrentUser();
  if (user) redirect("/gruppen");

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-4">
      <div className="w-full max-w-sm">{children}</div>
      <nav className="text-muted-foreground flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs">
        <Link href="/info" className="transition hover:text-foreground">
          {de.legal.footerNav.info}
        </Link>
        <span aria-hidden>·</span>
        <Link href="/datenschutz" className="transition hover:text-foreground">
          {de.legal.footerNav.privacy}
        </Link>
        <span aria-hidden>·</span>
        <Link href="/impressum" className="transition hover:text-foreground">
          {de.legal.footerNav.impressum}
        </Link>
      </nav>
    </main>
  );
}
