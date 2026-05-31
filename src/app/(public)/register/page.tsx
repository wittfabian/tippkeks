import Link from "next/link";

import { AuthForm } from "@/components/auth/auth-form";
import { Wordmark } from "@/components/brand/logo";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAppSettings } from "@/lib/data/settings";
import { createClient } from "@/lib/supabase/server";
import { de } from "@/messages/de";

export const metadata = { title: de.auth.registerTitle };

export default async function RegisterPage() {
  const supabase = await createClient();
  const { registrationEnabled } = await getAppSettings(supabase);

  return (
    <Card>
      <CardHeader>
        <Wordmark size={32} className="mb-1" />
        <CardTitle>{de.auth.registerTitle}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {registrationEnabled ? (
          <AuthForm mode="register" />
        ) : (
          <p role="status" className="text-muted-foreground text-sm">
            {de.auth.registrationClosed}
          </p>
        )}
        <Link
          href="/login"
          className="text-muted-foreground hover:text-foreground block text-center text-sm"
        >
          {de.auth.toLogin}
        </Link>
      </CardContent>
    </Card>
  );
}
