import { isAuthApiError, type User } from "@supabase/supabase-js";

// `new_email` alone doesn't mean "outstanding": GoTrue leaves it populated on
// some paths that have already applied the address, and a request that matches
// the address in use is nothing to wait for. Comparing the two is what makes
// the pending notice disappear when the change actually lands.
export function pendingEmailOf(user: Pick<User, "email" | "new_email"> | undefined): string {
  const pending = user?.new_email ?? "";
  return pending && pending !== user?.email ? pending : "";
}

// One key per message the Account section can show. Keeping this a closed union
// means a new GoTrue code can only ever land on "generic" — never on undefined.
export type EmailChangeErrorKey = "taken" | "rateLimited" | "invalid" | "generic";

const BY_CODE: Record<string, EmailChangeErrorKey> = {
  email_exists: "taken",
  user_already_exists: "taken",
  over_email_send_rate_limit: "rateLimited",
  over_request_rate_limit: "rateLimited",
  email_address_invalid: "invalid",
  validation_failed: "invalid",
};

export function emailChangeErrorKey(error: unknown): EmailChangeErrorKey {
  if (!isAuthApiError(error)) return "generic";

  const byCode = error.code ? BY_CODE[error.code] : undefined;
  if (byCode) return byCode;

  if (error.status === 429) return "rateLimited";
  if (/already (been )?registered|already exists/i.test(error.message)) return "taken";

  return "generic";
}
