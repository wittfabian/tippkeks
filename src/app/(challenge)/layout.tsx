/**
 * Step-up auth pages (e.g. the /mfa login challenge). Centred like (public) and
 * (reset), but deliberately WITHOUT the "redirect signed-in users away" guard:
 * the user IS signed in here (at aal1) and must complete the second factor — the
 * (app) layout bounces them here, so this layout must not bounce them back.
 */
export default function ChallengeLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <div className="w-full max-w-sm">{children}</div>
    </main>
  );
}
