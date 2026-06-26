import "server-only";

import { cached } from "@/lib/cache/cache";
import type { Json } from "@/lib/supabase/database.types";
import type { ServerClient } from "@/lib/supabase/server";

/** App-wide feature toggles, with safe-on defaults when a row is missing. */
export interface AppSettings {
  registrationEnabled: boolean;
  groupCreationEnabled: boolean;
}

const DEFAULTS: AppSettings = {
  registrationEnabled: true,
  groupCreationEnabled: true,
};

/** Read a `{"enabled": boolean}` flag value, falling back when malformed/absent. */
function readFlag(value: Json | undefined, fallback: boolean): boolean {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const enabled = (value as { enabled?: Json }).enabled;
    if (typeof enabled === "boolean") return enabled;
  }
  return fallback;
}

/**
 * Load the global feature toggles. Readable by anon (the register page checks
 * registration before any session exists) thanks to the app_setting RLS policy.
 */
export async function getAppSettings(supabase: ServerClient): Promise<AppSettings> {
  // Two global flags, read on nearly every page (incl. anon /register). Cached
  // under tag "app-settings", invalidated when an admin saves settings. The
  // value is identical for everyone, so sharing one entry is correct.
  return cached({ key: "app-settings", ttlSeconds: 300, tags: ["app-settings"] }, async () => {
    const { data, error } = await supabase.from("app_setting").select("key, value");
    // Throw on a real query error so we never cache guessed toggles for the TTL
    // (see getTournamentData). A successful-but-empty result still falls back to
    // DEFAULTS below — a missing row is legitimate, a failed query is not.
    if (error) throw new Error(`[data:app-settings] query failed: ${error.message}`);
    const byKey = new Map((data ?? []).map((row) => [row.key, row.value]));
    return {
      registrationEnabled: readFlag(
        byKey.get("registration_enabled"),
        DEFAULTS.registrationEnabled,
      ),
      groupCreationEnabled: readFlag(
        byKey.get("group_creation_enabled"),
        DEFAULTS.groupCreationEnabled,
      ),
    };
  });
}
