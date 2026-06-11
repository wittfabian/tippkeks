import Link from "next/link";

import { NewPasswordForm } from "@/components/auth/new-password-form";
import { Wordmark } from "@/components/brand/logo";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { de } from "@/messages/de";

export const metadata = { title: de.auth.newPasswordTitle };

export default async function NewPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string }>;
}) {
  // The recovery link carries its single-use token here (verified on submit, so
  // rendering this page — including by a link-scanner — never spends it). Show
  // the form whenever that token is present, or when a session already exists
  // (the legacy path where /auth/confirm verified first). Neither means the link
  // is missing, already used or expired.
  const { token_hash: tokenHash } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const canReset = Boolean(tokenHash) || Boolean(data?.claims?.sub);

  return (
    <Card>
      <CardHeader>
        <Wordmark size={32} className="mb-1" />
        <CardTitle>{de.auth.newPasswordTitle}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {canReset ? (
          <>
            <p className="text-muted-foreground text-sm">{de.auth.newPasswordIntro}</p>
            <NewPasswordForm tokenHash={tokenHash ?? null} />
          </>
        ) : (
          <>
            <p role="alert" className="text-destructive text-sm">
              {de.auth.newPasswordNoSession}
            </p>
            <Link href="/forgot-password" className={buttonVariants({ className: "w-full" })}>
              {de.auth.requestNewLink}
            </Link>
          </>
        )}
      </CardContent>
    </Card>
  );
}
