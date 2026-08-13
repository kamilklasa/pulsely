import type { AuthenticatorAssuranceLevels, Factor } from "@supabase/supabase-js";

export type TotpFactor = Factor<"totp", "verified">;

export interface AssuranceLevels {
  currentLevel: AuthenticatorAssuranceLevels | null;
  nextLevel: AuthenticatorAssuranceLevels | null;
}

// One key per message the Security section can show.
export type TwoFactorErrorKey =
  | "invalidCode"
  | "expiredChallenge"
  | "factorLimit"
  | "rateLimited"
  | "totpDisabled"
  | "generic";

// What `enroll()` returns that the UI actually renders: the QR code to scan and
// the secret to type when scanning isn't possible. Never logged.
export interface TotpEnrolment {
  factorId: string;
  qrCode: string;
  secret: string;
}
