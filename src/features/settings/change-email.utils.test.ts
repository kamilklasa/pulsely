import { AuthApiError, AuthError } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { emailChangeErrorKey, pendingEmailOf } from "./change-email.utils";

function apiError(message: string, status: number, code?: string) {
  return new AuthApiError(message, status, code);
}

describe("emailChangeErrorKey", () => {
  it("reads the taken address off the documented code", () => {
    expect(emailChangeErrorKey(apiError("Email address already exists", 422, "email_exists"))).toBe(
      "taken",
    );
    expect(
      emailChangeErrorKey(apiError("User already registered", 422, "user_already_exists")),
    ).toBe("taken");
  });

  it("separates the two rate limits GoTrue can hit", () => {
    expect(
      emailChangeErrorKey(apiError("Email rate limit exceeded", 429, "over_email_send_rate_limit")),
    ).toBe("rateLimited");
    expect(
      emailChangeErrorKey(apiError("Request rate limit reached", 429, "over_request_rate_limit")),
    ).toBe("rateLimited");
  });

  it("treats a rejected address as invalid", () => {
    expect(
      emailChangeErrorKey(apiError("Email address is invalid", 400, "email_address_invalid")),
    ).toBe("invalid");
    expect(
      emailChangeErrorKey(apiError("Unable to validate email", 422, "validation_failed")),
    ).toBe("invalid");
  });

  // Older GoTrue builds answer without `code`, so the status and the message are
  // all we get — the user still deserves the specific message, not "try again".
  it("falls back to status and message when the code is missing", () => {
    expect(emailChangeErrorKey(apiError("Email rate limit exceeded", 429))).toBe("rateLimited");
    expect(
      emailChangeErrorKey(
        apiError("A user with this email address has already been registered", 422),
      ),
    ).toBe("taken");
  });

  it("calls anything it cannot place generic", () => {
    expect(emailChangeErrorKey(apiError("Database error", 500, "unexpected_failure"))).toBe(
      "generic",
    );
    expect(emailChangeErrorKey(new AuthError("Failed to fetch"))).toBe("generic");
    expect(emailChangeErrorKey(new TypeError("Failed to fetch"))).toBe("generic");
    expect(emailChangeErrorKey(undefined)).toBe("generic");
  });
});

describe("pendingEmailOf", () => {
  it("reports the address the account is still waiting on", () => {
    expect(pendingEmailOf({ email: "old@example.com", new_email: "new@example.com" })).toBe(
      "new@example.com",
    );
  });

  it("reports nothing when there is no request in flight", () => {
    expect(pendingEmailOf({ email: "old@example.com" })).toBe("");
    expect(pendingEmailOf({ email: "old@example.com", new_email: "" })).toBe("");
    expect(pendingEmailOf(undefined)).toBe("");
  });

  it("reports nothing once the request matches the address in use", () => {
    expect(pendingEmailOf({ email: "new@example.com", new_email: "new@example.com" })).toBe("");
  });
});
