import * as v from "valibot";

// Shared by create-task and edit-task's schemas, which each wrap this with
// their own `TFunction<namespace>` closure for locale-correct messages.
export function requiredTitleSchema(message: string) {
  return v.pipe(v.string(), v.trim(), v.nonEmpty(message));
}
