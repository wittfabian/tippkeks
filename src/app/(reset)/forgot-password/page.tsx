import Link from "next/link";

import { ResetRequestForm } from "@/components/auth/reset-request-form";
import { Wordmark } from "@/components/brand/logo";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { de } from "@/messages/de";

export const metadata = { title: de.auth.resetTitle };

export default function ForgotPasswordPage() {
  return (
    <Card>
      <CardHeader>
        <Wordmark size={32} className="mb-1" />
        <CardTitle>{de.auth.resetTitle}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground text-sm">{de.auth.resetIntro}</p>
        <ResetRequestForm />
        <Link
          href="/login"
          className="text-muted-foreground hover:text-foreground block text-center text-sm"
        >
          {de.auth.backToLogin}
        </Link>
      </CardContent>
    </Card>
  );
}
