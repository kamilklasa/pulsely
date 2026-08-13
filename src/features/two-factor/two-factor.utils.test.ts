import { AuthApiError, AuthError, type Factor } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import {
  activeTotpFactors,
  factorLabel,
  needsBackupFactor,
  normalizeTotpCode,
  requiresChallenge,
  twoFactorErrorKey,
} from "./two-factor.utils";

function apiError(message: string, status: number, code?: string) {
  return new AuthApiError(message, status, code);
}

function factor(overrides: Partial<Factor> = {}): Factor {
  return {
    id: crypto.randomUUID(),
    factor_type: "totp",
    status: "verified",
    created_at: "2026-08-12T10:00:00Z",
    updated_at: "2026-08-12T10:00:00Z",
    ...overrides,
  } as Factor;
}

describe("twoFactorErrorKey", () => {
  // The wrong six digits is the error this feature shows most, and it is the one
  // that must never read as "something went wrong" — the user needs to know the
  // code was wrong, not that the app broke.
  it("names a rejected code", () => {
    expect(
      twoFactorErrorKey(apiError("Invalid TOTP code entered", 422, "mfa_verification_failed")),
    ).toBe("invalidCode");
    expect(
      twoFactorErrorKey(apiError("MFA verification rejected", 403, "mfa_verification_rejected")),
    ).toBe("invalidCode");
  });

  // A challenge outlives the code the user is typing; saying "expired" tells them
  // to press the button again rather than blame their authenticator app.
  it("separates an expired challenge from a wrong code", () => {
    expect(
      twoFactorErrorKey(apiError("MFA challenge has expired", 422, "mfa_challenge_expired")),
    ).toBe("expiredChallenge");
  });

  it("names the enrolment cap, since retrying will never clear it", () => {
    expect(
      twoFactorErrorKey(
        apiError("Too many factors enrolled", 422, "too_many_enrolled_mfa_factors"),
      ),
    ).toBe("factorLimit");
  });

  it("reads both rate limits GoTrue can answer with", () => {
    expect(
      twoFactorErrorKey(apiError("Request rate limit reached", 429, "over_request_rate_limit")),
    ).toBe("rateLimited");
    expect(twoFactorErrorKey(apiError("Slow down", 429))).toBe("rateLimited");
  });

  // Enrolment is disabled by default in config.toml, so this is the error a
  // misconfigured environment produces — worth its own message during setup.
  it("names TOTP being switched off server-side", () => {
    expect(
      twoFactorErrorKey(apiError("TOTP enroll disabled", 422, "mfa_totp_enroll_not_enabled")),
    ).toBe("totpDisabled");
    expect(
      twoFactorErrorKey(apiError("TOTP verify disabled", 422, "mfa_totp_verify_not_enabled")),
    ).toBe("totpDisabled");
  });

  it("lands anything unrecognised on generic rather than undefined", () => {
    expect(twoFactorErrorKey(apiError("Kaboom", 500, "unexpected_failure"))).toBe("generic");
    expect(twoFactorErrorKey(new AuthError("offline"))).toBe("generic");
    expect(twoFactorErrorKey(new Error("network"))).toBe("generic");
    expect(twoFactorErrorKey(undefined)).toBe("generic");
  });
});

describe("activeTotpFactors", () => {
  // `enroll()` creates the factor before the first code is checked. Counting an
  // unverified one as active would flip the switch on for a factor that cannot
  // sign anybody in — the exact failure the acceptance criteria rule out.
  it("ignores factors that were never verified", () => {
    const verified = factor({ status: "verified" });
    const pending = factor({ status: "unverified" });

    expect(activeTotpFactors([verified, pending])).toEqual([verified]);
  });

  it("ignores factor types this feature does not enrol", () => {
    const totp = factor();
    const phone = factor({ factor_type: "phone" });

    expect(activeTotpFactors([totp, phone])).toEqual([totp]);
  });

  it("survives the session having no factors at all", () => {
    expect(activeTotpFactors(undefined)).toEqual([]);
    expect(activeTotpFactors([])).toEqual([]);
  });
});

describe("needsBackupFactor", () => {
  // ADR-0001: Supabase has no recovery codes, so a second factor is the only
  // backup a user can have. Exactly one factor is the lockout-prone state.
  it("asks for a backup only while a single factor is active", () => {
    expect(needsBackupFactor([factor()])).toBe(true);
    expect(needsBackupFactor([factor(), factor()])).toBe(false);
  });

  it("stays quiet before 2FA is on at all", () => {
    expect(needsBackupFactor([])).toBe(false);
    expect(needsBackupFactor([factor({ status: "unverified" })])).toBe(false);
  });
});

describe("normalizeTotpCode", () => {
  // Authenticator apps display "123 456", and copying the code brings the space
  // along. Rejecting the exact string the app showed would be absurd.
  it("drops the whitespace an authenticator app renders", () => {
    expect(normalizeTotpCode("123 456")).toBe("123456");
    expect(normalizeTotpCode("  123456\n")).toBe("123456");
  });

  it("leaves an already-clean code alone", () => {
    expect(normalizeTotpCode("123456")).toBe("123456");
  });
});

describe("factorLabel", () => {
  // GoTrue makes `friendly_name` optional, and three different screens name the
  // same factor — they must not disagree about what to call an unnamed one.
  it("falls back to the caller's label when the factor is unnamed", () => {
    expect(factorLabel(factor({ friendly_name: "Phone" }), "Authenticator")).toBe("Phone");
    expect(factorLabel(factor({ friendly_name: undefined }), "Authenticator")).toBe(
      "Authenticator",
    );
    expect(factorLabel(undefined, "Authenticator")).toBe("Authenticator");
  });
});

describe("requiresChallenge", () => {
  // The signal that a signed-in session still owes a code. `_authenticated`
  // reads it to decide whether the board is allowed to render.
  it("is true only when the session can still climb to aal2", () => {
    expect(requiresChallenge({ currentLevel: "aal1", nextLevel: "aal2" })).toBe(true);
  });

  it("is false once the code has been accepted", () => {
    expect(requiresChallenge({ currentLevel: "aal2", nextLevel: "aal2" })).toBe(false);
  });

  it("is false for an account without 2FA", () => {
    expect(requiresChallenge({ currentLevel: "aal1", nextLevel: "aal1" })).toBe(false);
  });

  // Happens right after the last factor is removed: the session keeps the aal2
  // it earned while a factor still existed. Not a reason to demand a code.
  it("is false when the session outranks what the account now requires", () => {
    expect(requiresChallenge({ currentLevel: "aal2", nextLevel: "aal1" })).toBe(false);
  });

  it("does not challenge on an unknown assurance level", () => {
    expect(requiresChallenge({ currentLevel: null, nextLevel: null })).toBe(false);
    expect(requiresChallenge(undefined)).toBe(false);
  });
});
