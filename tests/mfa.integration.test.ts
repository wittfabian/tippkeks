import { createHmac } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import {
  SUPABASE_ANON_KEY,
  SUPABASE_URL,
  createSignedInUser,
  deleteUserByEmail,
  hasSupabase,
} from "./helpers";

const suite = hasSupabase ? describe : describe.skip;

const EMAIL = "itest_mfa@example.com";

/** Decode an RFC 4648 base32 string (the secret Supabase returns) to bytes. */
function base32Decode(input: string): Buffer {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const clean = input.replace(/=+$/, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of clean) {
    const idx = alphabet.indexOf(char);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      out.push((value >>> bits) & 0xff);
    }
  }
  return Buffer.from(out);
}

/** Compute a 6-digit TOTP (RFC 6238, SHA-1, 30s step) for the given moment. */
function totp(secret: string, atMs: number): string {
  const counter = Math.floor(atMs / 1000 / 30);
  const buf = Buffer.alloc(8);
  buf.writeBigInt64BE(BigInt(counter));
  const hmac = createHmac("sha1", base32Decode(secret)).update(buf).digest();
  const offset = hmac[hmac.length - 1]! & 0xf;
  const bin =
    ((hmac[offset]! & 0x7f) << 24) |
    ((hmac[offset + 1]! & 0xff) << 16) |
    ((hmac[offset + 2]! & 0xff) << 8) |
    (hmac[offset + 3]! & 0xff);
  return (bin % 1_000_000).toString().padStart(6, "0");
}

suite("MFA TOTP enrol + verify (integration)", () => {
  let client: SupabaseClient;
  let userId: string;

  beforeAll(async () => {
    await deleteUserByEmail(EMAIL);
    ({ client, userId } = await createSignedInUser(EMAIL, "password123"));
  }, 30_000);

  afterAll(async () => {
    await deleteUserByEmail(EMAIL);
  });

  it("starts at aal1 with no factors", async () => {
    const { data: aal } = await client.auth.mfa.getAuthenticatorAssuranceLevel();
    expect(aal?.currentLevel).toBe("aal1");
    expect(aal?.nextLevel).toBe("aal1");
  });

  it("enrols a TOTP factor and verifies it to reach aal2", async () => {
    const { data: enrolled, error: enrollError } = await client.auth.mfa.enroll({
      factorType: "totp",
    });
    expect(enrollError).toBeNull();
    const factorId = enrolled!.id;
    const secret = enrolled!.totp.secret;

    const { data: challenge, error: challengeError } = await client.auth.mfa.challenge({
      factorId,
    });
    expect(challengeError).toBeNull();

    const { error: verifyError } = await client.auth.mfa.verify({
      factorId,
      challengeId: challenge!.id,
      code: totp(secret, Date.now()),
    });
    expect(verifyError).toBeNull();

    const { data: aal } = await client.auth.mfa.getAuthenticatorAssuranceLevel();
    expect(aal?.currentLevel).toBe("aal2");
    expect(aal?.nextLevel).toBe("aal2");

    const { data: factors } = await client.auth.mfa.listFactors();
    expect((factors?.all ?? []).some((f) => f.status === "verified")).toBe(true);
  });

  it("rejects a wrong code", async () => {
    const { data: enrolled } = await client.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "second",
    });
    const factorId = enrolled!.id;
    const { data: challenge } = await client.auth.mfa.challenge({ factorId });
    const { error } = await client.auth.mfa.verify({
      factorId,
      challengeId: challenge!.id,
      code: "000000",
    });
    expect(error).not.toBeNull();
    await client.auth.mfa.unenroll({ factorId });
  });

  // The DB-level step-up gate (private.mfa_satisfied + restrictive policies +
  // RPC re-checks). A user who has a verified factor but only an aal1 session —
  // i.e. an attacker holding just the password — must be denied at the database,
  // not merely redirected by the (app) layout.
  it("denies gated reads and RPCs at aal1 once a factor is verified", async () => {
    // A fresh password sign-in lands at aal1 (Supabase does not auto-challenge).
    const aal1 = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error: signInError } = await aal1.auth.signInWithPassword({
      email: EMAIL,
      password: "password123",
    });
    expect(signInError).toBeNull();

    const { data: aal } = await aal1.auth.mfa.getAuthenticatorAssuranceLevel();
    expect(aal?.currentLevel).toBe("aal1");
    expect(aal?.nextLevel).toBe("aal2");

    // Restrictive RLS hides even the user's own profile until step-up.
    const { data: profile } = await aal1.from("profile").select("user_id").eq("user_id", userId);
    expect(profile ?? []).toHaveLength(0);

    // The definer RPC re-checks the gate (RLS alone can't, it bypasses) and refuses.
    const { error: rpcError } = await aal1.rpc("create_group", { p_name: "MFA Gate Test" });
    expect(rpcError).not.toBeNull();

    await aal1.auth.signOut();
  });

  it("allows the same reads once stepped up to aal2", async () => {
    // `client` reached aal2 in the enrol+verify test above.
    const { data: profile } = await client.from("profile").select("user_id").eq("user_id", userId);
    expect(profile ?? []).toHaveLength(1);
  });
});
