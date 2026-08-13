import { createHmac } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import {
  activeTotpFactors,
  needsBackupFactor,
  requiresChallenge,
  twoFactorErrorKey,
  twoFactorEnabled,
} from "./two-factor.utils";

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !anonKey || !serviceRoleKey) {
  throw new Error(
    "Missing Supabase env vars for the Seam B integration test — copy .env.example to .env.local",
  );
}

const admin = createClient(supabaseUrl, serviceRoleKey);

async function signIn(email: string): Promise<SupabaseClient> {
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  expect(linkError).toBeNull();

  const client = createClient(supabaseUrl!, anonKey!);
  const { error } = await client.auth.verifyOtp({
    email,
    token: linkData.properties!.email_otp,
    type: "email",
  });
  expect(error).toBeNull();
  return client;
}

function freshEmail() {
  return `seam-b-${crypto.randomUUID()}@example.com`;
}

function base32Decode(secret: string): Buffer {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const bytes: number[] = [];
  let value = 0;
  let bits = 0;

  for (const char of secret.replace(/=+$/, "").toUpperCase()) {
    const index = alphabet.indexOf(char);
    if (index === -1) continue;
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

// RFC 6238, the six digits an authenticator app would show. Standing in for the
// user's phone is the only way this seam can prove enrolment end to end.
function totpCode(secret: string, atMs = Date.now()): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(atMs / 1000 / 30)));

  const digest = createHmac("sha1", base32Decode(secret)).update(counter).digest();
  const offset = digest[digest.length - 1]! & 0x0f;
  const truncated = digest.readUInt32BE(offset) & 0x7fffffff;

  return (truncated % 1_000_000).toString().padStart(6, "0");
}

// GoTrue accepts one window of drift either side of now, which is what lets a
// test verify twice in a row without sitting out a real 30 seconds.
const NEXT_WINDOW_MS = 30_000;

async function enrolFactor(client: SupabaseClient, friendlyName: string) {
  const { data, error } = await client.auth.mfa.enroll({
    factorType: "totp",
    friendlyName,
  });
  expect(error).toBeNull();
  return { factorId: data!.id, secret: data!.totp.secret };
}

async function verifyFactor(client: SupabaseClient, factorId: string, code: string) {
  const { data: challenge, error: challengeError } = await client.auth.mfa.challenge({ factorId });
  expect(challengeError).toBeNull();

  return client.auth.mfa.verify({
    factorId,
    challengeId: challenge!.id,
    code,
  });
}

async function listFactors(client: SupabaseClient) {
  const { data, error } = await client.auth.mfa.listFactors();
  expect(error).toBeNull();
  return data!.all;
}

// Seam B — real local Supabase (`supabase start`), no mocking. What the UI leans on
// and the unit tests cannot reach: that an unverified factor really does not count,
// that a fresh sign-in really is challenged, and what the server does to an
// un-enrolment that has not proven possession.
describe("two-factor TOTP (Seam B)", () => {
  it("leaves the factor unverified until the first code is accepted", async () => {
    const client = await signIn(freshEmail());
    const { factorId, secret } = await enrolFactor(client, "Phone");

    // The switch must not flip here: enroll() alone cannot sign anybody in.
    expect(twoFactorEnabled(await listFactors(client))).toBe(false);

    const { error } = await verifyFactor(client, factorId, totpCode(secret));
    expect(error).toBeNull();

    const factors = await listFactors(client);
    expect(twoFactorEnabled(factors)).toBe(true);
    expect(activeTotpFactors(factors).map((factor) => factor.id)).toEqual([factorId]);
  });

  it("refuses a wrong code and keeps 2FA off", async () => {
    const client = await signIn(freshEmail());
    const { factorId, secret } = await enrolFactor(client, "Phone");

    const { error } = await verifyFactor(client, factorId, "000000");
    expect(error).not.toBeNull();
    expect(twoFactorErrorKey(error)).toBe("invalidCode");
    expect(twoFactorEnabled(await listFactors(client))).toBe(false);

    // And the rejection is not terminal — the right code still works after it.
    const { error: retryError } = await verifyFactor(client, factorId, totpCode(secret));
    expect(retryError).toBeNull();
    expect(twoFactorEnabled(await listFactors(client))).toBe(true);
  });

  it("challenges the next sign-in and clears the challenge once the code lands", async () => {
    const email = freshEmail();
    const enrolling = await signIn(email);
    const { factorId, secret } = await enrolFactor(enrolling, "Phone");
    await verifyFactor(enrolling, factorId, totpCode(secret));

    // A brand new session for an account that has a factor: authenticated, but
    // one step short of what the account requires.
    const returning = await signIn(email);
    const { data: onSignIn } = await returning.auth.mfa.getAuthenticatorAssuranceLevel();
    expect(onSignIn?.currentLevel).toBe("aal1");
    expect(onSignIn?.nextLevel).toBe("aal2");
    expect(requiresChallenge(onSignIn!)).toBe(true);

    const { error } = await verifyFactor(
      returning,
      factorId,
      totpCode(secret, Date.now() + NEXT_WINDOW_MS),
    );
    expect(error).toBeNull();

    const { data: afterCode } = await returning.auth.mfa.getAuthenticatorAssuranceLevel();
    expect(afterCode?.currentLevel).toBe("aal2");
    expect(requiresChallenge(afterCode!)).toBe(false);
  });

  // ADR-0001. This is the step that downgrades account security, so a session
  // that merely exists must not be enough to take the factor off.
  it("refuses to un-enrol a session that has not proven possession", async () => {
    const email = freshEmail();
    const enrolling = await signIn(email);
    const { factorId, secret } = await enrolFactor(enrolling, "Phone");
    await verifyFactor(enrolling, factorId, totpCode(secret));

    const returning = await signIn(email);
    const { error } = await returning.auth.mfa.unenroll({ factorId });

    expect(error).not.toBeNull();
    expect(twoFactorEnabled(await listFactors(returning))).toBe(true);

    // The same session may remove it after answering a challenge.
    const { error: verifyError } = await verifyFactor(
      returning,
      factorId,
      totpCode(secret, Date.now() + NEXT_WINDOW_MS),
    );
    expect(verifyError).toBeNull();

    const { error: unenrolError } = await returning.auth.mfa.unenroll({ factorId });
    expect(unenrolError).toBeNull();
    expect(twoFactorEnabled(await listFactors(returning))).toBe(false);
  });

  // The backup is only a backup if it can answer the challenge — the situation it
  // exists for is that the first factor is gone, so the sign-in screen must not be
  // hard-wired to factor zero.
  it("lets the backup factor clear the sign-in challenge on its own", async () => {
    const email = freshEmail();
    const enrolling = await signIn(email);
    const first = await enrolFactor(enrolling, "Phone");
    await verifyFactor(enrolling, first.factorId, totpCode(first.secret));
    const backup = await enrolFactor(enrolling, "Backup");
    await verifyFactor(enrolling, backup.factorId, totpCode(backup.secret));

    const returning = await signIn(email);
    expect(
      requiresChallenge((await returning.auth.mfa.getAuthenticatorAssuranceLevel()).data!),
    ).toBe(true);

    // Answering with the *second* factor, never having touched the first.
    const { error } = await verifyFactor(
      returning,
      backup.factorId,
      totpCode(backup.secret, Date.now() + NEXT_WINDOW_MS),
    );
    expect(error).toBeNull();

    const { data: levels } = await returning.auth.mfa.getAuthenticatorAssuranceLevel();
    expect(levels?.currentLevel).toBe("aal2");
    expect(requiresChallenge(levels!)).toBe(false);
  });

  // The backup path the ADR chose over recovery codes: a second TOTP factor.
  it("takes a second factor as the backup and stops asking once it exists", async () => {
    const client = await signIn(freshEmail());
    const first = await enrolFactor(client, "Phone");
    await verifyFactor(client, first.factorId, totpCode(first.secret));

    expect(needsBackupFactor(await listFactors(client))).toBe(true);

    const second = await enrolFactor(client, "Backup");
    await verifyFactor(client, second.factorId, totpCode(second.secret));

    const factors = await listFactors(client);
    expect(activeTotpFactors(factors)).toHaveLength(2);
    expect(needsBackupFactor(factors)).toBe(false);
  });
});
