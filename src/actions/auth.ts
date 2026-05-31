"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { getAppSettings } from "@/lib/data/settings";
import { createClient } from "@/lib/supabase/server";
import { de } from "@/messages/de";
import type { ActionState } from "@/actions/types";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const registrationSchema = credentialsSchema.extend({
  displayName: z.string().trim().min(1).max(60),
});

export async function signInAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: de.auth.errorInvalid };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: de.auth.errorInvalid };

  redirect("/gruppen");
}

export async function signUpAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = registrationSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    displayName: formData.get("displayName"),
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: issue?.path[0] === "password" ? de.auth.passwordHint : de.auth.errorGeneric };
  }

  const supabase = await createClient();

  // Re-check the global toggle server-side — the trust boundary, not the page.
  const { registrationEnabled } = await getAppSettings(supabase);
  if (!registrationEnabled) return { error: de.auth.registrationClosed };

  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { display_name: parsed.data.displayName } },
  });
  if (error) {
    return {
      error: /registered|exists/i.test(error.message) ? de.auth.errorTaken : de.auth.errorGeneric,
    };
  }

  // When email confirmation is enabled (production) there is no session yet.
  if (!data.session) return { error: null, info: de.auth.checkEmail };

  redirect("/gruppen");
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
