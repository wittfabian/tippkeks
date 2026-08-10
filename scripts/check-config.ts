/**
 * Checks a deployment's configuration before you find out the hard way.
 *
 * Reads an env file and reports, per variable, whether it is present, plausible
 * and consistent with the others — plus the checks a schema cannot make: that
 * LEGAL_DIR actually holds both documents, that they are not still the
 * unedited examples, that the service-role key is not the anon key pasted twice.
 *
 * Run:
 *   pnpm check-config                    # .env.local
 *   pnpm check-config .env.prod          # before a deployment
 *   pnpm check-config .env.prod --online # additionally verify the Supabase keys work
 *                                        (hosted projects only — a local stack
 *                                        accepts any key, so it is skipped)
 *
 * Exit code 1 on errors, 0 on warnings only — so it can gate a deploy script.
 *
 * This is a companion to docs/configuration.md and src/lib/env.server.ts, not a
 * replacement: the schema decides what parses, this decides what is complete.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { config } from "dotenv";

type Severity = "ok" | "warn" | "error" | "skip";

interface Finding {
  key: string;
  severity: Severity;
  detail: string;
}

interface Section {
  title: string;
  findings: Finding[];
}

const args = process.argv.slice(2);
const online = args.includes("--online");
const envPath = args.find((arg) => !arg.startsWith("--")) ?? ".env.local";

// `quiet` suppresses dotenv's own banner — this script's output is the report.
const parsed = config({ path: envPath, override: true, quiet: true });
if (parsed.error) {
  console.error(`Cannot read ${envPath}: ${parsed.error.message}`);
  process.exit(1);
}

/** Only the file's own keys — so an exported shell variable cannot mask a gap. */
const declared = parsed.parsed ?? {};
const value = (key: string): string | undefined => {
  const raw = declared[key];
  return raw && raw.trim() !== "" ? raw.trim() : undefined;
};

const ok = (key: string, detail: string): Finding => ({ key, severity: "ok", detail });
const warn = (key: string, detail: string): Finding => ({ key, severity: "warn", detail });
const error = (key: string, detail: string): Finding => ({ key, severity: "error", detail });
const skip = (key: string, detail: string): Finding => ({ key, severity: "skip", detail });

/** Show enough of a secret to recognise it, never enough to use it. */
function fingerprint(secret: string): string {
  return `set (${secret.length} chars, …${secret.slice(-4)})`;
}

function isUrl(candidate: string): boolean {
  try {
    new URL(candidate);
    return true;
  } catch {
    return false;
  }
}

function checkRequired(): Section {
  const findings: Finding[] = [];

  const url = value("NEXT_PUBLIC_SUPABASE_URL");
  if (!url) {
    findings.push(error("NEXT_PUBLIC_SUPABASE_URL", "missing — the app cannot start"));
  } else if (!isUrl(url)) {
    findings.push(error("NEXT_PUBLIC_SUPABASE_URL", `not a URL: ${url}`));
  } else {
    findings.push(ok("NEXT_PUBLIC_SUPABASE_URL", url));
  }

  const anon = value("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (!anon) {
    findings.push(error("NEXT_PUBLIC_SUPABASE_ANON_KEY", "missing — the app cannot start"));
  } else {
    findings.push(ok("NEXT_PUBLIC_SUPABASE_ANON_KEY", fingerprint(anon)));
  }

  const service = value("SUPABASE_SERVICE_ROLE_KEY");
  if (!service) {
    findings.push(
      error(
        "SUPABASE_SERVICE_ROLE_KEY",
        "missing — sync, admin overrides and managed members fail",
      ),
    );
  } else if (service === anon) {
    // Pasting the anon key here is the failure that looks like it works: every
    // service-role path then runs under RLS and silently returns nothing.
    findings.push(
      error(
        "SUPABASE_SERVICE_ROLE_KEY",
        "identical to the anon key — paste the secret key instead",
      ),
    );
  } else {
    findings.push(ok("SUPABASE_SERVICE_ROLE_KEY", fingerprint(service)));
  }

  return { title: "Required", findings };
}

function checkPublicDeployment(): Section {
  const findings: Finding[] = [];

  const siteUrl = value("SITE_URL");
  if (!siteUrl) {
    findings.push(
      warn("SITE_URL", "not set — auth mails will link to the container's own address"),
    );
  } else if (!isUrl(siteUrl)) {
    findings.push(error("SITE_URL", `not a URL: ${siteUrl}`));
  } else {
    // Report every problem at once: fixing one and rediscovering the next on the
    // following run is exactly the loop this script exists to avoid.
    const problems: string[] = [];
    if (!siteUrl.startsWith("https://"))
      problems.push("not https (fine locally, not in production)");
    if (siteUrl.endsWith("/")) problems.push("trailing slash makes links https://host//path");
    findings.push(
      problems.length > 0
        ? warn("SITE_URL", `${siteUrl} — ${problems.join("; ")}`)
        : ok("SITE_URL", siteUrl),
    );
  }

  findings.push(...checkLegalDir());

  const email = value("OPERATOR_EMAIL");
  if (!email) {
    findings.push(warn("OPERATOR_EMAIL", "not set — no contact address, and push stays disabled"));
  } else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    findings.push(error("OPERATOR_EMAIL", `not an email address: ${email}`));
  } else {
    findings.push(ok("OPERATOR_EMAIL", email));
  }

  const cronSecret = value("CRON_SECRET");
  if (!cronSecret) {
    findings.push(
      warn("CRON_SECRET", "not set — /api/cron/sync stays closed, results never refresh"),
    );
  } else if (cronSecret.length < 32) {
    findings.push(
      warn("CRON_SECRET", `only ${cronSecret.length} chars — use \`openssl rand -hex 32\``),
    );
  } else {
    findings.push(ok("CRON_SECRET", fingerprint(cronSecret)));
  }

  const actionsKey = value("NEXT_SERVER_ACTIONS_ENCRYPTION_KEY");
  if (!actionsKey) {
    findings.push(
      warn(
        "NEXT_SERVER_ACTIONS_ENCRYPTION_KEY",
        "not set — every rebuild rotates it and breaks open forms; mandatory with >1 replica",
      ),
    );
  } else if (Buffer.from(actionsKey, "base64").length !== 32) {
    findings.push(
      error(
        "NEXT_SERVER_ACTIONS_ENCRYPTION_KEY",
        "not 32 base64-encoded bytes — use `openssl rand -base64 32`",
      ),
    );
  } else {
    findings.push(ok("NEXT_SERVER_ACTIONS_ENCRYPTION_KEY", fingerprint(actionsKey)));
  }

  return { title: "Public deployment", findings };
}

/**
 * The one check worth having: an operator who copied the examples and never got
 * round to editing them publishes a privacy policy naming somebody else's
 * hosting provider. Nothing else in the stack would ever complain.
 */
function checkLegalDir(): Finding[] {
  const dir = value("LEGAL_DIR");
  if (!dir) {
    return [warn("LEGAL_DIR", "not set — /imprint and /privacy say no document is configured")];
  }

  const findings: Finding[] = [];
  for (const name of ["imprint", "privacy"] as const) {
    const file = join(dir, `${name}.html`);
    let html: string;
    try {
      html = readFileSync(file, "utf8");
    } catch {
      findings.push(error("LEGAL_DIR", `${file} is missing or unreadable`));
      continue;
    }

    if (html.trim() === "") {
      findings.push(error("LEGAL_DIR", `${name}.html is empty`));
    } else if (html.includes("NOT LEGAL ADVICE")) {
      findings.push(
        error("LEGAL_DIR", `${name}.html is still the unedited example — replace the placeholders`),
      );
    } else if (/<html|<body|<head/i.test(html)) {
      findings.push(
        warn("LEGAL_DIR", `${name}.html looks like a full page; a fragment is expected`),
      );
    } else {
      findings.push(ok("LEGAL_DIR", `${name}.html (${html.length} chars)`));
    }
  }

  return findings;
}

function checkOptional(): Section {
  const findings: Finding[] = [];

  findings.push(
    value("FOOTBALL_DATA_API_TOKEN")
      ? ok(
          "FOOTBALL_DATA_API_TOKEN",
          `set — competition ${value("FOOTBALL_DATA_COMPETITION") ?? "WC"}`,
        )
      : skip("FOOTBALL_DATA_API_TOKEN", "no live result sync"),
  );

  const redisUrl = value("REDIS_URL");
  const redisPassword = value("REDIS_PASSWORD");
  if (redisUrl) {
    findings.push(
      isUrl(redisUrl)
        ? ok("REDIS_URL", redisUrl.replace(/:\/\/[^@]*@/, "://***@"))
        : error("REDIS_URL", `not a URL: ${redisUrl}`),
    );
  } else if (redisPassword) {
    findings.push(ok("REDIS_PASSWORD", "set — URL is assembled for the compose network"));
  } else {
    findings.push(skip("REDIS_URL", "cache no-ops, rate limits fail open"));
  }

  const vapidPublic = value("NEXT_PUBLIC_VAPID_PUBLIC_KEY");
  const vapidPrivate = value("VAPID_PRIVATE_KEY");
  if (vapidPublic && vapidPrivate) {
    const subject =
      value("VAPID_SUBJECT") ?? (value("OPERATOR_EMAIL") ? "mailto: + OPERATOR_EMAIL" : "");
    findings.push(
      subject
        ? ok("VAPID", `push enabled — contact ${subject}`)
        : error("VAPID", "keys set but no contact — set VAPID_SUBJECT or OPERATOR_EMAIL"),
    );
  } else if (vapidPublic || vapidPrivate) {
    findings.push(
      error("VAPID", "only one half of the key pair is set — push stays off until both are"),
    );
  } else {
    findings.push(skip("VAPID", "no push notifications"));
  }

  return { title: "Optional", findings };
}

/** Everything the app reads. An unknown key in the file is usually a typo. */
const KNOWN_KEYS = new Set([
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SITE_URL",
  "LEGAL_DIR",
  "OPERATOR_EMAIL",
  "CRON_SECRET",
  "NEXT_SERVER_ACTIONS_ENCRYPTION_KEY",
  "FOOTBALL_DATA_API_TOKEN",
  "FOOTBALL_DATA_COMPETITION",
  "REDIS_URL",
  "REDIS_PASSWORD",
  "NEXT_PUBLIC_VAPID_PUBLIC_KEY",
  "VAPID_PRIVATE_KEY",
  "VAPID_SUBJECT",
]);

function checkUnknownKeys(): Section {
  const findings = Object.keys(declared)
    .filter((key) => !KNOWN_KEYS.has(key))
    .map((key) => warn(key, "not read by the app — typo, or left over from an older version?"));

  return { title: "Unrecognised keys", findings };
}

/**
 * Do the keys actually work? Only a request can answer that.
 *
 * Deliberately refuses to run against a local stack: the Supabase CLI's gateway
 * accepts any API key at all, so every probe would come back green and report
 * that a typo is fine. A check that cannot fail is worse than no check.
 */
async function checkOnline(): Promise<Section> {
  const findings: Finding[] = [];
  const url = value("NEXT_PUBLIC_SUPABASE_URL");
  const anon = value("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const service = value("SUPABASE_SERVICE_ROLE_KEY");

  if (!url || !anon || !isUrl(url)) {
    return { title: "Connectivity", findings: [skip("Supabase", "no usable URL or anon key")] };
  }

  if (["localhost", "127.0.0.1", "::1"].includes(new URL(url).hostname)) {
    return {
      title: "Connectivity",
      findings: [skip("Supabase", "local stack accepts any key — nothing to verify")],
    };
  }

  const request = async (path: string, key: string) =>
    fetch(`${url}${path}`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });

  try {
    const response = await request("/rest/v1/", anon);
    findings.push(
      response.ok
        ? ok("anon key", `accepted by ${url}`)
        : error("anon key", `rejected: ${response.status} ${response.statusText}`),
    );
  } catch (cause) {
    findings.push(error("anon key", `unreachable: ${(cause as Error).message}`));
  }

  if (service) {
    // The admin API is the one thing an anon key cannot reach, so it separates a
    // real secret key from the anon key pasted into the wrong slot.
    try {
      const response = await request("/auth/v1/admin/users?page=1&per_page=1", service);
      findings.push(
        response.ok
          ? ok("service-role key", "accepted for the admin API")
          : error(
              "service-role key",
              `not accepted as service role: ${response.status} ${response.statusText}`,
            ),
      );
    } catch (cause) {
      findings.push(error("service-role key", `unreachable: ${(cause as Error).message}`));
    }
  }

  return { title: "Connectivity", findings };
}

const MARKS: Record<Severity, string> = { ok: "✓", warn: "!", error: "✗", skip: "○" };

function report(sections: Section[]): void {
  const width = Math.max(
    ...sections.flatMap((section) => section.findings.map((finding) => finding.key.length)),
    0,
  );

  for (const section of sections) {
    if (section.findings.length === 0) continue;
    console.log(`\n${section.title}`);
    for (const { key, severity, detail } of section.findings) {
      console.log(`  ${MARKS[severity]} ${key.padEnd(width)}  ${detail}`);
    }
  }

  const all = sections.flatMap((section) => section.findings);
  const errors = all.filter((finding) => finding.severity === "error").length;
  const warnings = all.filter((finding) => finding.severity === "warn").length;

  console.log(
    `\n${errors} error${errors === 1 ? "" : "s"}, ${warnings} warning${warnings === 1 ? "" : "s"}` +
      (errors === 0 && warnings === 0 ? " — looks good." : ". See docs/configuration.md."),
  );

  if (errors > 0) process.exitCode = 1;
}

async function main() {
  console.log(`TippKeks configuration check — ${envPath}`);

  const sections = [
    checkRequired(),
    checkPublicDeployment(),
    checkOptional(),
    checkUnknownKeys(),
    ...(online ? [await checkOnline()] : []),
  ];

  report(sections);
}

void main();
