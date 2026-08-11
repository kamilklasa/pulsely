import { requiredTitleSchema } from "@/entities/task";
import type { TFunction } from "i18next";

// See sign-in.schema.ts — built from a `t()` closure so validation messages
// come from the active locale rather than being hardcoded. Description is
// free text with no validation, so only title needs a schema.
export function createTitleSchema(t: TFunction<"edit-task">) {
  return requiredTitleSchema(t("form.titleRequired"));
}
