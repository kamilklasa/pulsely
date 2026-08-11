import * as v from "valibot";
import type { TFunction } from "i18next";

// Messages come from the "sign-in" catalog rather than being hardcoded, so
// the schema is built from a `t()` closure instead of exported as a static
// instance — see SignInForm.tsx, which memoizes it per current language.
export function createEmailSchema(t: TFunction<"sign-in">) {
  return v.pipe(
    v.string(),
    v.trim(),
    v.nonEmpty(t("form.emailRequired")),
    v.email(t("form.emailInvalid")),
  );
}

export type EmailInput = string;
