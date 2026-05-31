import Link from "next/link";

import { NewPasswordForm } from "@/components/auth/new-password-form";
import { Wordmark } from "@/components/brand/logo";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { de } from "@/messages/de";

export const metadata = { title: de.auth.newPasswordTitle };

export default async function NewPasswordPage() {
  // The recovery link runs through /auth/confirm first, which sets the session.
  // No claims here means the link is missing, already used or expired.
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const hasSession = Boolean(data?.claims?.sub);

  return (
    <Card>
      <CardHeader>
        <Wordmark size={32} className="mb-1" />
        <CardTitle>{de.auth.newPasswordTitle}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {hasSession ? (
          <>
            <p className="text-muted-foreground text-sm">{de.auth.newPasswordIntro}</p>
            <NewPasswordForm />
          </>
        ) : (
          <>
            <p role="alert" className="text-destructive text-sm">
              {de.auth.newPasswordNoSession}
            </p>
            <Link href="/passwort-vergessen" className={buttonVariants({ className: "w-full" })}>
              {de.auth.requestNewLink}
            </Link>
          </>
        )}
      </CardContent>
    </Card>
  );
}
