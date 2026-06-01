"use server";

import { revalidatePath } from "next/cache";

import { invalidateTags } from "@/lib/cache/cache";
import { isSiteAdmin } from "@/lib/auth/membership";
import { createClient } from "@/lib/supabase/server";
import { de } from "@/messages/de";
import { logActionError, type ActionState } from "@/actions/types";

/**
 * Save the global feature toggles. Site-admin only — checked here and enforced
 * again by the app_setting RLS update policy (the action is the trust boundary,
 * RLS the final gate). Checkboxes are absent from FormData when unticked.
 */
export async function updateAppSettingsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return { error: de.settings.error };
  if (!(await isSiteAdmin(supabase))) return { error: de.settings.error };

  const registrationEnabled = formData.get("registrationEnabled") === "on";
  const groupCreationEnabled = formData.get("groupCreationEnabled") === "on";

  const updates: { key: string; enabled: boolean }[] = [
    { key: "registration_enabled", enabled: registrationEnabled },
    { key: "group_creation_enabled", enabled: groupCreationEnabled },
  ];

  for (const { key, enabled } of updates) {
    const { error } = await supabase
      .from("app_setting")
      .update({ value: { enabled }, updated_by: userId })
      .eq("key", key);
    if (error) {
      logActionError("updateAppSettings", error);
      return { error: de.settings.error };
    }
  }

  await invalidateTags("app-settings");
  revalidatePath("/einstellungen");
  revalidatePath("/register");
  revalidatePath("/");
  return { error: null, info: de.settings.saved };
}
