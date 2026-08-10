import "server-only";

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { serverEnv } from "@/lib/env.server";

/** The documents an operator supplies, named after the routes that render them. */
export type LegalDocumentName = "imprint" | "privacy";

/**
 * Load an operator-supplied legal document, or null when this deployment has
 * none.
 *
 * The repository deliberately ships no Impressum and no privacy policy. Such a
 * text names a concrete hosting provider, a concrete mail provider and a
 * concrete supervisory authority — ship one and every self-hoster publishes
 * claims that are false for them. So the operator mounts their own HTML and
 * LEGAL_DIR points at it.
 *
 * Read per request rather than cached: an operator correcting their privacy
 * policy should not have to restart the container to publish the fix.
 */
export async function readLegalDocument(name: LegalDocumentName): Promise<string | null> {
  const dir = serverEnv.LEGAL_DIR;
  if (!dir) return null;

  try {
    const html = await readFile(join(dir, `${name}.html`), "utf8");
    return html.trim() === "" ? null : html;
  } catch (error) {
    // A missing file is the ordinary "not configured" case. Anything else —
    // unreadable, a directory, bad permissions — is a misconfiguration the
    // operator needs to see rather than silently serve an empty page over.
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      console.error(`Could not read legal document "${name}" from ${dir}:`, error);
    }
    return null;
  }
}
