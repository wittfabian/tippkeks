"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { de } from "@/messages/de";
import type { ActionState } from "@/actions/types";

const schema = z.object({
  slug: z.string().min(1),
  displayName: z.string().trim().min(1).max(60),
});

export async function updateProfileAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = schema.safeParse({
    slug: formData.get("slug"),
    displayName: formData.get("displayName"),
  });
  if (!parsed.success) return { error: de.profile.error };

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return { error: de.profile.error };

  const { error } = await supabase
    .from("profile")
    .update({ display_name: parsed.data.displayName })
    .eq("user_id", userId);
  if (error) return { error: de.profile.error };

  revalidatePath(`/${parsed.data.slug}/profil`);
  return { error: null, info: de.profile.saved };
}
