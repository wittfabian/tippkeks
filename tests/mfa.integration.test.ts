import { createHmac } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createSignedInUser, deleteUserByEmail, hasSupabase } from "./helpers";

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

  beforeAll(async () => {
    await deleteUserByEmail(EMAIL);
    ({ client } = await createSignedInUser(EMAIL, "password123"));
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
});
