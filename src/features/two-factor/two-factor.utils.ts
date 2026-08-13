import { isAuthApiError, type Factor } from "@supabase/supabase-js";
import type { AssuranceLevels, TotpFactor, TwoFactorErrorKey } from "./two-factor.types";

const BY_CODE: Record<string, TwoFactorErrorKey> = {
  mfa_verification_failed: "invalidCode",
  mfa_verification_rejected: "invalidCode",
  mfa_challenge_expired: "expiredChallenge",
  too_many_enrolled_mfa_factors: "factorLimit",
  mfa_totp_enroll_not_enabled: "totpDisabled",
  mfa_totp_verify_not_enabled: "totpDisabled",
  over_request_rate_limit: "rateLimited",
};

// Closed union, same shape as emailChangeErrorKey: a GoTrue code this file has
// never heard of can only ever land on "generic", never on a missing message.
export function twoFactorErrorKey(error: unknown): TwoFactorErrorKey {
  if (!isAuthApiError(error)) return "generic";

  const byCode = error.code ? BY_CODE[error.code] : undefined;
  if (byCode) return byCode;

  if (error.status === 429) return "rateLimited";

  return "generic";
}

// `enroll()` hands back a factor before any code has been checked, and an
// abandoned enrolment leaves it behind. Only a verified TOTP factor can actually
// answer a challenge, so only those count as 2FA being on.
export function activeTotpFactors(factors: Factor[] | undefined): TotpFactor[] {
  if (!factors) return [];
  return factors.filter(
    (candidate): candidate is TotpFactor =>
      candidate.factor_type === "totp" && candidate.status === "verified",
  );
}

export function twoFactorEnabled(factors: Factor[] | undefined): boolean {
  return activeTotpFactors(factors).length > 0;
}

// ADR-0001: there are no recovery codes to fall back on, so a single factor is
// one lost phone away from a lockout that only an admin can undo.
export function needsBackupFactor(factors: Factor[] | undefined): boolean {
  return activeTotpFactors(factors).length === 1;
}

const SVG_DATA_URI_PREFIX = "data:image/svg+xml;utf-8,";

// The Supabase docs say to build the image source by prepending this prefix to
// `totp.qr_code`, but GoTrue already ships it prefixed — following the docs
// nested one data URI inside another and the QR silently never rendered.
// Normalising both shapes means a version that changes its mind cannot break it.
//
// The markup is percent-encoded either way: GoTrue sends raw `<`, quotes and
// newlines, which browsers forgive in a data URI but which are not valid in one.
export function qrCodeSrc(qrCode: string): string {
  if (!qrCode) return "";

  const markup = qrCode.startsWith(SVG_DATA_URI_PREFIX)
    ? qrCode.slice(SVG_DATA_URI_PREFIX.length)
    : qrCode;

  return `${SVG_DATA_URI_PREFIX}${encodeURIComponent(markup)}`;
}

// Authenticator apps show the code as "123 456" and the space comes along when
// it is copied. Stripping beats rejecting the exact string the app displayed.
export function normalizeTotpCode(code: string): string {
  return code.replace(/\s/gu, "");
}

// `friendly_name` is optional in GoTrue, and the setup dialog, the Security list
// and the sign-in challenge all put a factor's name on screen — one helper so
// they cannot disagree about what an unnamed factor is called.
export function factorLabel(
  factor: Pick<Factor, "friendly_name"> | null | undefined,
  fallback: string,
): string {
  return factor?.friendly_name ?? fallback;
}

// A session that *could* be aal2 but is only aal1 is one that signed in and
// still owes a code. Every other combination — including the aal2/aal1 left
// behind by removing the last factor — is already settled.
export function requiresChallenge(levels: AssuranceLevels | undefined): boolean {
  return levels?.currentLevel === "aal1" && levels.nextLevel === "aal2";
}
