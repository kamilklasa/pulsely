import * as v from "valibot";
import type { TFunction } from "i18next";
import { normalizeTotpCode } from "./two-factor.utils";

export const TOTP_CODE_LENGTH = 6;

// See change-email.schema.ts — built from a `t()` closure so the messages follow
// the active locale. Authenticator apps render the code with a space in the
// middle, and pasting it that way is the common case, so the space is stripped
// rather than rejected.
export function createTotpCodeSchema(t: TFunction<"two-factor">) {
  return v.pipe(
    v.string(),
    v.transform(normalizeTotpCode),
    v.nonEmpty(t("code.required")),
    v.regex(/^\d+$/u, t("code.digitsOnly")),
    v.length(TOTP_CODE_LENGTH, t("code.length", { count: TOTP_CODE_LENGTH })),
  );
}
