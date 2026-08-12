import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { emailChangeErrorKey, pendingEmailOf } from "./change-email.utils";

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !anonKey || !serviceRoleKey) {
  throw new Error(
    "Missing Supabase env vars for the Seam B integration test — copy .env.example to .env.local",
  );
}

const admin = createClient(supabaseUrl, serviceRoleKey);

async function signIn(email: string): Promise<SupabaseClient> {
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  expect(linkError).toBeNull();

  const client = createClient(supabaseUrl!, anonKey!);
  const { error } = await client.auth.verifyOtp({
    email,
    token: linkData.properties!.email_otp,
    type: "email",
  });
  expect(error).toBeNull();
  return client;
}

function freshEmail() {
  return `seam-b-${crypto.randomUUID()}@example.com`;
}

// Seam B — real local Supabase (`supabase start`), no mocking. Covers what the UI
// leans on and the unit tests can't reach: that a requested change is *pending*
// rather than applied, and which error code a taken address really produces.
describe("email change (Seam B)", () => {
  it("parks the new address in new_email and leaves the session on the old one", async () => {
    const currentEmail = freshEmail();
    const nextEmail = freshEmail();
    const client = await signIn(currentEmail);

    const { data, error } = await client.auth.updateUser({ email: nextEmail });
    expect(error).toBeNull();
    expect(data.user?.email).toBe(currentEmail);
    expect(data.user?.new_email).toBe(nextEmail);

    // The pending address has to survive a reload, or the dialog would forget it.
    const { data: sessionData } = await client.auth.getSession();
    expect(sessionData.session?.user.new_email).toBe(nextEmail);
  });

  it("only surfaces a change confirmed elsewhere once the session is refreshed", async () => {
    const currentEmail = freshEmail();
    const nextEmail = freshEmail();
    const client = await signIn(currentEmail);
    const { data: requested } = await client.auth.updateUser({ email: nextEmail });

    // Stands in for the two links being opened in a mail client: the change lands
    // server-side, and nothing tells this client about it.
    const { error: adminError } = await admin.auth.admin.updateUserById(requested.user!.id, {
      email: nextEmail,
      email_confirm: true,
    });
    expect(adminError).toBeNull();

    const { data: stale } = await client.auth.getSession();
    expect(stale.session?.user.email).toBe(currentEmail);

    // Which is why `useResolvePendingEmail` asks. The refreshed session is what
    // clears `new_email` and lets the dialog drop the pending notice.
    const { data: refreshed, error } = await client.auth.refreshSession();
    expect(error).toBeNull();
    expect(refreshed.user?.email).toBe(nextEmail);
    expect(pendingEmailOf(refreshed.user!)).toBe("");
  });

  it("rejects an address another account already owns", async () => {
    const takenEmail = freshEmail();
    await signIn(takenEmail);
    const client = await signIn(freshEmail());

    const { error } = await client.auth.updateUser({ email: takenEmail });
    expect(error).not.toBeNull();
    expect(emailChangeErrorKey(error)).toBe("taken");
  });
});
