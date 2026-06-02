/** Result of a form Server Action, consumed by useActionState on the client. */
export type ActionState = {
  error: string | null;
  info?: string | null;
  /** Set by signInAction when the account exists but its email is unconfirmed —
   *  the login form then offers a "resend confirmation email" button. */
  needsConfirmation?: boolean;
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
