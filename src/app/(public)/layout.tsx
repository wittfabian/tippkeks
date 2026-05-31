import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/membership";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  // Signed-in users have no business on login/register.
  const user = await getCurrentUser();
  if (user) redirect("/gruppen");

  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <div className="w-full max-w-sm">{children}</div>
    </main>
  );
}
