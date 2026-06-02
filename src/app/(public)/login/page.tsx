import Link from "next/link";

import { AuthForm } from "@/components/auth/auth-form";
import { Wordmark } from "@/components/brand/logo";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { de } from "@/messages/de";

export const metadata = { title: de.auth.loginTitle };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string }>;
}) {
  const { invite } = await searchParams;
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
          <Link href={registerHref} className="text-muted-foreground hover:text-foreground block">
            {de.auth.toRegister}
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
