import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !anonKey || !serviceRoleKey) {
  throw new Error(
    "Missing Supabase env vars for the Seam B integration test — copy .env.example to .env.local",
  );
}

// Seam B — real local Supabase (`supabase start`), no mocking, same magic-link redemption as
// task.integration.test.ts. The rules under test here (RLS isolation, one open entry per owner)
// live in Postgres, so only a real database can show they hold.
async function signInAsNewUser(): Promise<SupabaseClient> {
  const admin = createClient(supabaseUrl!, serviceRoleKey!);
  const email = `seam-b-time-entry-${crypto.randomUUID()}@example.com`;
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

  return client;
}

async function createTask(client: SupabaseClient, title: string): Promise<string> {
  const { data, error } = await client.from("task").insert({ title }).select().single();
  if (error) throw error;
  return data.id;
}

describe("time entry CRUD + RLS isolation (Seam B)", () => {
  let clientA: SupabaseClient;
  let clientB: SupabaseClient;
  let taskAId: string;
  let taskBId: string;
  let entryAId: string;
  let entryBId: string;

  beforeAll(async () => {
    [clientA, clientB] = await Promise.all([signInAsNewUser(), signInAsNewUser()]);
    [taskAId, taskBId] = await Promise.all([
      createTask(clientA, "User A's task"),
      createTask(clientB, "User B's task"),
    ]);

    // Stopped entries, so the "one open entry per owner" index stays free for the tests below.
    const [{ data: entryA, error: errorA }, { data: entryB, error: errorB }] = await Promise.all([
      clientA
        .from("time_entry")
        .insert({
          task_id: taskAId,
          started_at: "2026-08-12T09:00:00.000Z",
          stopped_at: "2026-08-12T09:30:00.000Z",
        })
        .select()
        .single(),
      clientB
        .from("time_entry")
        .insert({
          task_id: taskBId,
          started_at: "2026-08-12T09:00:00.000Z",
          stopped_at: "2026-08-12T09:30:00.000Z",
        })
        .select()
        .single(),
    ]);
    if (errorA) throw errorA;
    if (errorB) throw errorB;
    entryAId = entryA.id;
    entryBId = entryB.id;
  });

  it("assigns owner_id from the authenticated user on insert", async () => {
    const { data: user } = await clientA.auth.getUser();
    const { data: entry } = await clientA
      .from("time_entry")
      .select("owner_id")
      .eq("id", entryAId)
      .single();
    expect(entry?.owner_id).toBe(user.user?.id);
  });

  it("a user's select only ever returns their own entries", async () => {
    const { data, error } = await clientA.from("time_entry").select("*");
    expect(error).toBeNull();
    expect(data?.map((entry) => entry.id)).toEqual([entryAId]);
  });

  // Owning the entry is not enough: without the task check in the insert policy a user could
  // file their own time against somebody else's task and quietly inflate its total.
  it("a user cannot log time against another user's task", async () => {
    const { error } = await clientA
      .from("time_entry")
      .insert({ task_id: taskBId, started_at: new Date().toISOString() });
    expect(error).not.toBeNull();

    const { data: theirEntries } = await clientB.from("time_entry").select("id");
    expect(theirEntries?.map((entry) => entry.id)).toEqual([entryBId]);
  });

  it("a user's update against another user's entry affects no rows", async () => {
    const { data, error } = await clientA
      .from("time_entry")
      .update({ stopped_at: "2026-08-12T23:00:00.000Z" })
      .eq("id", entryBId)
      .select();
    expect(error).toBeNull();
    expect(data).toEqual([]);

    const { data: stillIntact } = await clientB
      .from("time_entry")
      .select("stopped_at")
      .eq("id", entryBId)
      .single();
    expect(stillIntact?.stopped_at).toBe("2026-08-12T09:30:00+00:00");
  });

  it("a user's delete against another user's entry affects no rows", async () => {
    const { data, error } = await clientA.from("time_entry").delete().eq("id", entryBId).select();
    expect(error).toBeNull();
    expect(data).toEqual([]);

    const { data: stillThere } = await clientB
      .from("time_entry")
      .select("id")
      .eq("id", entryBId)
      .maybeSingle();
    expect(stillThere?.id).toBe(entryBId);
  });

  it("records a start as a running entry and fixes its duration on stop", async () => {
    const startedAt = "2026-08-12T12:00:00.000Z";
    const { data: started, error: startError } = await clientA
      .from("time_entry")
      .insert({ task_id: taskAId, started_at: startedAt })
      .select()
      .single();
    expect(startError).toBeNull();
    expect(started.stopped_at).toBeNull();
    expect(started.source).toBe("manual");

    const { data: stopped, error: stopError } = await clientA
      .from("time_entry")
      .update({ stopped_at: "2026-08-12T12:25:00.000Z" })
      .is("stopped_at", null)
      .select()
      .single();
    expect(stopError).toBeNull();
    expect(stopped.id).toBe(started.id);
    expect(Date.parse(stopped.stopped_at) - Date.parse(stopped.started_at)).toBe(25 * 60_000);

    await clientA.from("time_entry").delete().eq("id", started.id);
  });

  // The two statements useStartTimer issues, in the order it issues them, against a database that
  // already has a run open. The ordering is the whole rule: insert-then-close would trip the unique
  // index, and closing on `stopped_at is null` (rather than on an id) is what also catches a run
  // this client never saw.
  it("hands the timer over to another task in one start", async () => {
    const otherTaskId = await createTask(clientA, "The task being handed to");
    const { data: first } = await clientA
      .from("time_entry")
      .insert({ task_id: taskAId, started_at: "2026-08-12T14:00:00.000Z" })
      .select()
      .single();

    const handoverAt = "2026-08-12T14:10:00.000Z";
    const { error: closeError } = await clientA
      .from("time_entry")
      .update({ stopped_at: handoverAt })
      .is("stopped_at", null);
    expect(closeError).toBeNull();
    const { data: second, error: startError } = await clientA
      .from("time_entry")
      .insert({ task_id: otherTaskId, started_at: handoverAt })
      .select()
      .single();
    expect(startError).toBeNull();

    const { data: open } = await clientA.from("time_entry").select("id").is("stopped_at", null);
    expect(open?.map((entry) => entry.id)).toEqual([second.id]);

    const { data: closed } = await clientA
      .from("time_entry")
      .select("stopped_at")
      .eq("id", first.id)
      .single();
    // No gap and no overlap: the run that ended and the run that began share the instant.
    expect(Date.parse(closed!.stopped_at)).toBe(Date.parse(second.started_at));

    await clientA.from("time_entry").delete().in("id", [first.id, second.id]);
  });

  // The domain layer closes the open run before starting the next one; this index is what stops
  // two devices racing past that rule and leaving the board with two clocks running.
  it("refuses a second running entry for the same owner", async () => {
    const { data: running, error } = await clientA
      .from("time_entry")
      .insert({ task_id: taskAId, started_at: new Date().toISOString() })
      .select()
      .single();
    expect(error).toBeNull();

    const { error: duplicateError } = await clientA
      .from("time_entry")
      .insert({ task_id: taskAId, started_at: new Date().toISOString() });
    expect(duplicateError?.code).toBe("23505");

    // Another user running their own timer is not a conflict — the index is per owner.
    const { error: theirError } = await clientB
      .from("time_entry")
      .insert({ task_id: taskBId, started_at: new Date().toISOString() });
    expect(theirError).toBeNull();

    await clientA.from("time_entry").delete().eq("id", running.id);
    await clientB.from("time_entry").delete().is("stopped_at", null);
  });

  it("drops a task's entries with the task", async () => {
    const taskId = await createTask(clientA, "Short-lived task");
    const { data: entry } = await clientA
      .from("time_entry")
      .insert({
        task_id: taskId,
        started_at: "2026-08-12T13:00:00.000Z",
        stopped_at: "2026-08-12T13:10:00.000Z",
      })
      .select()
      .single();

    await clientA.from("task").delete().eq("id", taskId);

    const { data: orphan } = await clientA
      .from("time_entry")
      .select("id")
      .eq("id", entry.id)
      .maybeSingle();
    expect(orphan).toBeNull();
  });
});
