/** Result of a form Server Action, consumed by useActionState on the client. */
export type ActionState = {
  error: string | null;
  info?: string | null;
};

export const initialActionState: ActionState = { error: null, info: null };
