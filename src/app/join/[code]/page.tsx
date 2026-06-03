import type { Metadata } from "next";
import Link from "next/link";

import { Wordmark } from "@/components/brand/logo";
import { InviteAcceptForm } from "@/components/groups/invite-accept-form";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/membership";
import { de } from "@/messages/de";

// Invite-flavoured preview copy so a shared link reads like an invitation.
// Next merges metadata shallowly, so redefining openGraph/twitter here replaces
// the whole object inherited from the root — the brand image must be re-stated
// (resolved against metadataBase) or the shared link would show no preview image.
const previewImage = { url: "/opengraph-image", width: 1200, height: 630, alt: de.app.name };
export const metadata: Metadata = {
  title: de.invite.confirmTitle,
  openGraph: {
    title: de.invite.welcomeTitle,
    description: de.invite.welcomeBody,
    images: [previewImage],
  },
  twitter: {
    card: "summary_large_image",
    title: de.invite.welcomeTitle,
    description: de.invite.welcomeBody,
    images: [previewImage],
  },
};

/**
 * Public landing for a shared invite link. Sits at the top level (outside the
 * (app)/(public) layout groups) so neither layout's auth redirect interferes:
 * a logged-out friend must be able to view it. Authenticated → one-click accept;
 * logged-out → register/login with the code threaded through so the auth action
 * redeems it on success and lands them directly in the group.
 */
export default async function JoinByLinkPage({ params }: { params: Promise<{ code: string }> }) {
  const { code: raw } = await params;
  const code = raw.trim().toUpperCase();
  const user = await getCurrentUser();

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-4">
      <div className="w-full max-w-sm">
        <Card>
          <CardHeader>
            <Wordmark size={32} className="mb-1" />
            <CardTitle>{user ? de.invite.confirmTitle : de.invite.welcomeTitle}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {user ? (
              <>
                <p className="text-muted-foreground text-sm">{de.invite.confirmBody}</p>
                <InviteAcceptForm code={code} />
              </>
            ) : (
              <>
                <p className="text-muted-foreground text-sm">{de.invite.welcomeBody}</p>
                <div className="space-y-2">
                  <Link
                    href={`/register?invite=${encodeURIComponent(code)}`}
                    className={buttonVariants({ className: "w-full" })}
                  >
                    {de.invite.createAccount}
                  </Link>
                  <Link
                    href={`/login?invite=${encodeURIComponent(code)}`}
                    className={buttonVariants({ variant: "secondary", className: "w-full" })}
                  >
                    {de.invite.haveAccount}
                  </Link>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
