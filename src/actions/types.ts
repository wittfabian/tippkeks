/** Result of a form Server Action, consumed by useActionState on the client. */
export type ActionState = {
  error: string | null;
  info?: string | null;
  /** Set by signInAction when the account exists but its email is unconfirmed —
   *  the login form then offers a "resend confirmation email" button. */
  needsConfirmation?: boolean;
  /** Set by convertManagedMemberAction when the assigned email already belongs to
   *  a real account: the convert form then asks to confirm merging the managed
   *  member's tips into it. `mergeEmail` carries the address back for the confirm
   *  submit (the original input is replaced by the confirmation prompt). */
  needsMergeConfirm?: boolean;
  mergeEmail?: string;
};

export const initialActionState: ActionState = { error: null, info: null };

/**
 * Log a server-side failure before returning a generic user-facing message.
 * Actions deliberately surface one friendly string to users; this keeps the
 * real Supabase/Postgres error diagnosable in server logs instead of swallowed.
 */
export function logActionError(scope: string, error: unknown): void {
  console.error(`[action:${scope}]`, error);
}
