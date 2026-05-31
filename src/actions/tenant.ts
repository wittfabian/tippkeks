"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { isSiteAdmin } from "@/lib/auth/membership";
import { getAppSettings } from "@/lib/data/settings";
import { createClient } from "@/lib/supabase/server";
import { de } from "@/messages/de";
import type { ActionState } from "@/actions/types";

const createSchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/),
});

export async function createGroupAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = createSchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
  });
  if (!parsed.success) return { error: de.groups.createError };

  const supabase = await createClient();

  // Honour the global toggle; site admins always bypass it. The create_group
  // RPC enforces this again as the non-bypassable gate.
  const { groupCreationEnabled } = await getAppSettings(supabase);
  if (!groupCreationEnabled && !(await isSiteAdmin(supabase))) {
    return { error: de.groups.createDisabled };
  }

  const { data, error } = await supabase.rpc("create_group", {
    p_name: parsed.data.name,
    p_slug: parsed.data.slug,
  });
  if (error || !data) return { error: de.groups.createError };

  redirect(`/${data.slug}`);
}

const joinSchema = z.object({ code: z.string().trim().min(1).max(64) });

export async function joinGroupAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = joinSchema.safeParse({ code: formData.get("code") });
  if (!parsed.success) return { error: de.groups.joinError };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("redeem_invite", { p_code: parsed.data.code });
  if (error || !data) return { error: de.groups.joinError };

  redirect(`/${data.slug}`);
}
