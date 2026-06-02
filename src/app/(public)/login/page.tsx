import Link from "next/link";

import { AuthForm } from "@/components/auth/auth-form";
import { Wordmark } from "@/components/brand/logo";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAppSettings } from "@/lib/data/settings";
import { createClient } from "@/lib/supabase/server";
import { de } from "@/messages/de";

export const metadata = { title: de.auth.loginTitle };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string }>;
}) {
  const { invite } = await searchParams;
  // Hide the "create account" link when registration is closed (mirrors the
  // register page, which shows a closed notice). Read as anon, pre-session.
  const supabase = await createClient();
  const { registrationEnabled } = await getAppSettings(supabase);
  const registerHref = invite ? `/register?invite=${encodeURIComponent(invite)}` : "/register";
  return (
    <Card>
      <CardHeader>
        <Wordmark size={32} className="mb-1" />
        <CardTitle>{de.auth.loginTitle}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <AuthForm mode="login" invite={invite} />
        <div className="space-y-1 text-center text-sm">
          <Link
            href="/forgot-password"
            className="text-muted-foreground hover:text-foreground block"
          >
            {de.auth.forgotPassword}
          </Link>
          {registrationEnabled && (
            <Link href={registerHref} className="text-muted-foreground hover:text-foreground block">
              {de.auth.toRegister}
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
