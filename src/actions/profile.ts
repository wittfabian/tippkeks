"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { de } from "@/messages/de";
import { logActionError, type ActionState } from "@/actions/types";

/** Resolve the signed-in user's id and email from validated JWT claims. */
async function currentUser(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  const email = (data?.claims?.email as string | undefined) ?? null;
  return { userId, email };
}

const displayNameSchema = z.object({
  displayName: z.string().trim().min(1).max(60),
});

export async function updateDisplayNameAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = displayNameSchema.safeParse({
    displayName: formData.get("displayName"),
  });
  if (!parsed.success) return { error: de.profile.error };

  const supabase = await createClient();
  const { userId } = await currentUser(supabase);
  if (!userId) return { error: de.profile.error };

  const { error } = await supabase
    .from("profile")
    .update({ display_name: parsed.data.displayName })
    .eq("user_id", userId);
  if (error) {
    logActionError("updateDisplayName", error);
    return { error: de.profile.error };
  }

  revalidatePath("/profile");
  return { error: null, info: de.profile.saved };
}

const emailSchema = z.object({ email: z.string().trim().email() });

export async function updateEmailAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = emailSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { error: de.profile.emailError };

  const supabase = await createClient();
  const { userId, email } = await currentUser(supabase);
  if (!userId) return { error: de.profile.emailError };
  if (email && email.toLowerCase() === parsed.data.email.toLowerCase()) {
    return { error: de.profile.emailUnchanged };
  }

  // Supabase sends a confirmation link; the change applies only once confirmed.
  const { error } = await supabase.auth.updateUser({ email: parsed.data.email });
  if (error) {
    logActionError("updateEmail", error);
    return { error: de.profile.emailError };
  }

  return { error: null, info: de.profile.emailSaved };
}

const passwordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

export async function updatePasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = passwordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      error: issue?.path[0] === "newPassword" ? de.profile.passwordHint : de.profile.passwordError,
    };
  }

  const supabase = await createClient();
  const { userId, email } = await currentUser(supabase);
  if (!userId || !email) return { error: de.profile.passwordError };

  // Re-authenticate with the current password before allowing a change.
  const { error: reauthError } = await supabase.auth.signInWithPassword({
    email,
    password: parsed.data.currentPassword,
  });
  if (reauthError) return { error: de.profile.passwordError };

  const { error } = await supabase.auth.updateUser({ password: parsed.data.newPassword });
  if (error) return { error: de.profile.passwordError };

  return { error: null, info: de.profile.passwordSaved };
}

const deleteSchema = z.object({ currentPassword: z.string().min(1) });

/**
 * Permanently delete the signed-in user's account. The `delete_own_account`
 * RPC does it atomically in one transaction: it guards the "every tenant keeps
 * ≥1 admin" invariant (groups where the user is the sole admin but others
 * remain raise SOLE_ADMIN), deletes groups where the user is the only member,
 * and removes the auth user (FKs cascade the rest). Requires a current-password
 * reauth first so a hijacked session can't trigger deletion.
 */
export async function deleteAccountAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = deleteSchema.safeParse({ currentPassword: formData.get("currentPassword") });
  if (!parsed.success) return { error: de.profile.deleteError };

  const supabase = await createClient();
  const { userId, email } = await currentUser(supabase);
  if (!userId || !email) return { error: de.profile.deleteError };

  const { error: reauthError } = await supabase.auth.signInWithPassword({
    email,
    password: parsed.data.currentPassword,
  });
  if (reauthError) return { error: de.profile.deleteError };

  const { error } = await supabase.rpc("delete_own_account");
  if (error) {
    if (error.message?.includes("SOLE_ADMIN")) return { error: de.profile.deleteSoleAdminError };
    logActionError("deleteAccount", error);
    return { error: de.profile.deleteError };
  }

  await supabase.auth.signOut();
  redirect("/login");
}
