import { redirect } from "next/navigation";

import { LandingPage } from "@/components/landing/landing-page";
import { getCurrentUser } from "@/lib/auth/membership";

// Public marketing entry point. Signed-in users skip it and land on their groups.
export default async function RootPage() {
  const user = await getCurrentUser();
  if (user) redirect("/gruppen");
  return <LandingPage />;
}
