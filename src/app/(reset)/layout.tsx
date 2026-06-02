/**
 * Password-recovery pages. Centred like (public), but deliberately WITHOUT its
 * "redirect signed-in users away" guard: the recovery link signs the user in
 * before they reach /reset-password, where they still need to set a new password.
 */
export default function ResetLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <div className="w-full max-w-sm">{children}</div>
    </main>
  );
}
