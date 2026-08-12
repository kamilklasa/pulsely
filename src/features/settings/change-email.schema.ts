import * as v from "valibot";
import type { TFunction } from "i18next";

// See sign-in.schema.ts — built from a `t()` closure so validation messages come
// from the active locale. `currentEmail` is baked in too: GoTrue answers a
// no-op change with a success it never acts on, so the check has to be local.
export function createChangeEmailSchema(t: TFunction<"settings">, currentEmail: string) {
  return v.pipe(
    v.string(),
    v.trim(),
    v.nonEmpty(t("account.emailRequired")),
    v.email(t("account.emailInvalid")),
    v.check(
      (email) => email.toLowerCase() !== currentEmail.trim().toLowerCase(),
      t("account.emailUnchanged"),
    ),
  );
}
