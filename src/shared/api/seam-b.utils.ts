import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !anonKey || !serviceRoleKey) {
  throw new Error(
    "Missing Supabase env vars for the Seam B integration tests — copy .env.example to .env.local",
  );
}

// PostgREST rejects a JWT whose `iat` sits more than 30 seconds ahead of its own
// clock, answering PGRST303 "JWT issued at future". The tolerance is baked into
// the binary — there is no `jwt-skew` setting to raise.
//
// GoTrue stamps that `iat`, and both services share the Docker VM's clock, so
// they normally agree exactly. They stop agreeing when the VM's wall clock jumps
// — which is what happens after the host sleeps and the clock is yanked back on
// resume. Tokens minted around the jump are dead on arrival at PostgREST, and no
// amount of retrying inside the suite changes that: the environment is wrong,
// not the test.
//
// So this does not paper over the failure — it names it, at the door, before
// twenty assertions fail one by one with a message that explains nothing.
const CLOCK_ERROR_CODE = "PGRST303";

async function assertPostgrestAcceptsFreshTokens(client: SupabaseClient) {
  // `task` only because every Seam B suite that talks to PostgREST has it; the
  // row set is irrelevant, the status code is the whole point.
  const { error } = await client.from("task").select("id").limit(1);
  if (!error || error.code !== CLOCK_ERROR_CODE) return;

  throw new Error(
    `PostgREST rejected a token it was handed seconds ago (${CLOCK_ERROR_CODE}: ${error.message}).\n` +
      "The Docker VM's clock has drifted more than 30s from the token's `iat` — usually after " +
      "the host slept. Nothing in the app or the tests is broken.\n" +
      "Fix the clock and re-run: `supabase stop && supabase start` (restart Docker Desktop if it persists).",
  );
}

// Seam B — real local Supabase (`supabase start`), no mocking. Users are signed in
// by redeeming a magic link through the admin API rather than parsing Mailpit, since
// these suites are about RLS and auth behaviour, not email delivery.
export async function signInAsNewUser(emailPrefix: string): Promise<SupabaseClient> {
  const admin = createClient(supabaseUrl!, serviceRoleKey!);
  const email = `seam-b-${emailPrefix}-${crypto.randomUUID()}@example.com`;

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (linkError) throw linkError;

  const client = createClient(supabaseUrl!, anonKey!);
  const { error: verifyError } = await client.auth.verifyOtp({
    email,
    token: linkData.properties!.email_otp!,
    type: "email",
  });
  if (verifyError) throw verifyError;

  await assertPostgrestAcceptsFreshTokens(client);

  return client;
}
