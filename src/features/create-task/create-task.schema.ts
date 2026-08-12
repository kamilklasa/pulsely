import { requiredTitleSchema } from "@/entities/task";
import type { TFunction } from "i18next";

// See sign-in.schema.ts — built from a `t()` closure so validation messages
// come from the active locale rather than being hardcoded.
export function createTitleSchema(t: TFunction<"create-task">) {
  return requiredTitleSchema(t("form.titleRequired"));
}

export type TitleInput = string;
