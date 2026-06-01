import { MfaChallenge } from "@/components/auth/mfa-challenge";
import { Wordmark } from "@/components/brand/logo";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { de } from "@/messages/de";

export const metadata = { title: de.auth.mfaTitle };

/**
 * Second-factor login challenge. Reached at aal1 (after password sign-in) when
 * the account has a verified TOTP factor. The interactive verify happens
 * client-side; on success it redeems any pending invite and navigates on.
 */
export default async function MfaChallengePage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string; redirect?: string }>;
}) {
  const { invite, redirect } = await searchParams;
  return (
    <Card>
      <CardHeader>
        <Wordmark size={32} className="mb-1" />
        <CardTitle>{de.auth.mfaTitle}</CardTitle>
      </CardHeader>
      <CardContent>
        <MfaChallenge invite={invite} redirectTo={redirect} />
      </CardContent>
    </Card>
  );
}
