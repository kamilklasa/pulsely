import { isAuthApiError, type User, type UserIdentity } from "@supabase/supabase-js";

// One key per message the Integrations section can show. Closed union, same shape
// as emailChangeErrorKey: a GoTrue code this file has never heard of can only ever
// land on "generic", never on a missing message.
export type IntegrationErrorKey =
  | "lastIdentity"
  | "emailConflict"
  | "alreadyLinked"
  | "linkingDisabled"
  | "rateLimited"
  | "generic";

const BY_CODE: Record<string, IntegrationErrorKey> = {
  single_identity_not_deletable: "lastIdentity",
  email_conflict_identity_not_deletable: "emailConflict",
  identity_already_exists: "alreadyLinked",
  manual_linking_disabled: "linkingDisabled",
  over_request_rate_limit: "rateLimited",
};

export function integrationErrorKey(error: unknown): IntegrationErrorKey {
  if (!isAuthApiError(error)) return "generic";

  const byCode = error.code ? BY_CODE[error.code] : undefined;
  if (byCode) return byCode;

  if (error.status === 429) return "rateLimited";

  return "generic";
}

// Supabase records every identity the account can sign in with; Google is
// "connected" exactly when it's among them. Read off the session rather than the
// identities list so the row has an answer before any request comes back.
export function isGoogleConnected(user: Pick<User, "app_metadata"> | undefined): boolean {
  const providers = user?.app_metadata.providers;
  return Array.isArray(providers) && providers.includes("google");
}

// `unlinkIdentity` needs the identity itself, not the provider name — the DELETE
// goes to /user/identities/{identity_id}.
export function googleIdentityOf(identities: UserIdentity[] | undefined): UserIdentity | undefined {
  return identities?.find((identity) => identity.provider === "google");
}

// The last identity is the only way back into the account, so removing it is a
// lockout. GoTrue refuses it too (single_identity_not_deletable) — checking here
// is what turns that 422 into a sentence written before the user clicks.
export function canUnlinkIdentity(identities: UserIdentity[] | undefined): boolean {
  return (identities?.length ?? 0) > 1;
}

// An account can be linked to a Google address that isn't the one it signs in
// with, and "Connected as" is about the Google side of that pair.
export function identityEmailOf(identity: UserIdentity | undefined): string {
  const email = identity?.identity_data?.email;
  return typeof email === "string" ? email : "";
}
