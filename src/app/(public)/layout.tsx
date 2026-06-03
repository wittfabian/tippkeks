import { redirect } from "next/navigation";

import { LegalFooterNav } from "@/components/legal/legal-footer-nav";
import { getCurrentUser } from "@/lib/auth/membership";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  // Signed-in users have no business on login/register.
  const user = await getCurrentUser();
  if (user) redirect("/groups");

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-4">
      <div className="w-full max-w-sm">{children}</div>
      <nav className="text-muted-foreground flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs">
        <LegalFooterNav />
      </nav>
    </main>
  );
}
