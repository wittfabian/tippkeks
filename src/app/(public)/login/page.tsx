import Link from "next/link";

import { AuthForm } from "@/components/auth/auth-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { de } from "@/messages/de";

export const metadata = { title: de.auth.loginTitle };

export default function LoginPage() {
  return (
    <Card>
      <CardHeader>
        <p className="text-muted-foreground text-sm">{de.app.name}</p>
        <CardTitle>{de.auth.loginTitle}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <AuthForm mode="login" />
        <Link
          href="/register"
          className="text-muted-foreground hover:text-foreground block text-center text-sm"
        >
          {de.auth.toRegister}
        </Link>
      </CardContent>
    </Card>
  );
}
