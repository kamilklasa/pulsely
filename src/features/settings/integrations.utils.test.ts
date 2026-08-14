import { AuthApiError, AuthError, type UserIdentity } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import {
  canUnlinkIdentity,
  googleIdentityOf,
  identityEmailOf,
  integrationErrorKey,
  isGoogleConnected,
} from "./integrations.utils";

function apiError(message: string, status: number, code?: string) {
  return new AuthApiError(message, status, code);
}

function identity(provider: string, email = "kamil@example.com"): UserIdentity {
  return {
    id: crypto.randomUUID(),
    identity_id: crypto.randomUUID(),
    user_id: crypto.randomUUID(),
    provider,
    identity_data: { email, sub: crypto.randomUUID() },
    created_at: "2026-08-13T10:00:00Z",
    updated_at: "2026-08-13T10:00:00Z",
    last_sign_in_at: "2026-08-13T10:00:00Z",
  };
}

describe("integrationErrorKey", () => {
  // The refusal this feature exists to explain. "Something went wrong" would read
  // as a bug to retry, when the server is protecting the user from a lockout.
  it("names the last-identity refusal", () => {
    expect(
      integrationErrorKey(
        apiError("Cannot unlink the only identity", 422, "single_identity_not_deletable"),
      ),
    ).toBe("lastIdentity");
  });

  // A different refusal with the same verb: unlinking would move the account onto
  // an address someone else already holds. Retrying never fixes either, but only
  // one of them is about being the last way in.
  it("keeps the email conflict apart from the last identity", () => {
    expect(
      integrationErrorKey(
        apiError("Identity not deletable", 422, "email_conflict_identity_not_deletable"),
      ),
    ).toBe("emailConflict");
  });

  it("names a Google account that is already linked", () => {
    expect(
      integrationErrorKey(apiError("Identity is already linked", 422, "identity_already_exists")),
    ).toBe("alreadyLinked");
  });

  // The project-level switch. Every account fails the same way, so the message has
  // to point at configuration rather than invite the user to try again.
  it("names manual linking being off", () => {
    expect(
      integrationErrorKey(apiError("Manual linking is disabled", 422, "manual_linking_disabled")),
    ).toBe("linkingDisabled");
  });

  it("reads both rate limits GoTrue can answer with", () => {
    expect(
      integrationErrorKey(apiError("Request rate limit reached", 429, "over_request_rate_limit")),
    ).toBe("rateLimited");
    expect(integrationErrorKey(apiError("Too many requests", 429))).toBe("rateLimited");
  });

  it("falls back to generic for anything it has not been taught", () => {
    expect(integrationErrorKey(apiError("Boom", 500, "unexpected_failure"))).toBe("generic");
    expect(integrationErrorKey(new AuthError("Network down"))).toBe("generic");
    expect(integrationErrorKey(new Error("Network down"))).toBe("generic");
    expect(integrationErrorKey(undefined)).toBe("generic");
  });
});

describe("isGoogleConnected", () => {
  it("reads the provider list off the session", () => {
    expect(isGoogleConnected({ app_metadata: { providers: ["email", "google"] } })).toBe(true);
    expect(isGoogleConnected({ app_metadata: { providers: ["email"] } })).toBe(false);
  });

  // The session resolves after the first render, and `providers` is absent on
  // accounts old enough to predate it — neither is "connected".
  it("treats a missing session or a missing list as not connected", () => {
    expect(isGoogleConnected(undefined)).toBe(false);
    expect(isGoogleConnected({ app_metadata: {} })).toBe(false);
    expect(isGoogleConnected({ app_metadata: { provider: "google" } })).toBe(false);
  });
});

describe("googleIdentityOf", () => {
  it("picks the Google identity out of the list", () => {
    const google = identity("google");
    expect(googleIdentityOf([identity("email"), google])?.identity_id).toBe(google.identity_id);
  });

  it("is undefined while the list is loading, or when there is no Google", () => {
    expect(googleIdentityOf(undefined)).toBeUndefined();
    expect(googleIdentityOf([identity("email")])).toBeUndefined();
  });
});

describe("canUnlinkIdentity", () => {
  // Mirrors what GoTrue enforces, one click earlier: the last identity is the only
  // way back into the account.
  it("allows the removal only while another identity remains", () => {
    expect(canUnlinkIdentity([identity("email"), identity("google")])).toBe(true);
    expect(canUnlinkIdentity([identity("google")])).toBe(false);
  });

  it("refuses while the list is still loading", () => {
    expect(canUnlinkIdentity(undefined)).toBe(false);
    expect(canUnlinkIdentity([])).toBe(false);
  });
});

describe("identityEmailOf", () => {
  it("reads the address Google reported", () => {
    expect(identityEmailOf(identity("google", "kamil@gmail.com"))).toBe("kamil@gmail.com");
  });

  // `identity_data` is optional and free-form, so the row falls back to the
  // account's own address rather than rendering "Connected as undefined".
  it("is empty when the identity carries no address", () => {
    expect(identityEmailOf(undefined)).toBe("");
    expect(identityEmailOf({ ...identity("google"), identity_data: undefined })).toBe("");
    expect(identityEmailOf({ ...identity("google"), identity_data: { email: 42 } })).toBe("");
  });
});
