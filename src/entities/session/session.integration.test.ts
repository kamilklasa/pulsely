import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !anonKey || !serviceRoleKey) {
  throw new Error(
    "Missing Supabase env vars for the Seam B integration test — copy .env.example to .env.local",
  );
}

// Seam B — real local Supabase (`supabase start`), no mocking. Redeems a magic link via the
// admin API instead of parsing Inbucket/Mailpit HTML, since the point of this seam is verifying
// auth/session behaviour, not email delivery.
describe("session auth (Seam B)", () => {
  it("redeems a magic link into a persisted session, and sign-out clears it", async () => {
    const email = `seam-b-${crypto.randomUUID()}@example.com`;
    const admin = createClient(supabaseUrl, serviceRoleKey);

    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });
    expect(linkError).toBeNull();
    const emailOtp = linkData.properties?.email_otp;
    expect(emailOtp).toBeTruthy();

    const client = createClient(supabaseUrl, anonKey);
    const { data: verifyData, error: verifyError } = await client.auth.verifyOtp({
      email,
      token: emailOtp!,
      type: "email",
    });
    expect(verifyError).toBeNull();
    expect(verifyData.session).not.toBeNull();
    expect(verifyData.session?.user.email).toBe(email);

    const { data: sessionData } = await client.auth.getSession();
    expect(sessionData.session?.access_token).toBe(verifyData.session?.access_token);

    const { error: signOutError } = await client.auth.signOut();
    expect(signOutError).toBeNull();

    const { data: afterSignOut } = await client.auth.getSession();
    expect(afterSignOut.session).toBeNull();
  });
});
