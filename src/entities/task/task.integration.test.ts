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

// Seam B — real local Supabase (`supabase start`), no mocking. The point is proving RLS actually
// holds; a mocked client can't demonstrate that. Users are signed in via the admin API (magic
// link redemption), same approach as session.integration.test.ts.
async function signInAsNewUser(): Promise<SupabaseClient> {
  const admin = createClient(supabaseUrl!, serviceRoleKey!);
  const email = `seam-b-task-${crypto.randomUUID()}@example.com`;
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

describe("task CRUD + RLS isolation (Seam B)", () => {
  let clientA: SupabaseClient;
  let clientB: SupabaseClient;
  let taskAId: string;
  let taskBId: string;

  beforeAll(async () => {
    [clientA, clientB] = await Promise.all([signInAsNewUser(), signInAsNewUser()]);

    const { data: taskA, error: errorA } = await clientA
      .from("task")
      .insert({ title: "User A's task" })
      .select()
      .single();
    if (errorA) throw errorA;
    taskAId = taskA.id;

    const { data: taskB, error: errorB } = await clientB
      .from("task")
      .insert({ title: "User B's task" })
      .select()
      .single();
    if (errorB) throw errorB;
    taskBId = taskB.id;
  });

  it("assigns owner_id from the authenticated user on insert", async () => {
    const { data: user } = await clientA.auth.getUser();
    const { data: task } = await clientA.from("task").select("owner_id").eq("id", taskAId).single();
    expect(task?.owner_id).toBe(user.user?.id);
  });

  it("a user's select only ever returns their own tasks", async () => {
    const { data, error } = await clientA.from("task").select("*");
    expect(error).toBeNull();
    expect(data?.map((task) => task.id)).toEqual([taskAId]);
    expect(data?.some((task) => task.id === taskBId)).toBe(false);
  });

  it("a user cannot select another user's task by id", async () => {
    const { data, error } = await clientA.from("task").select("*").eq("id", taskBId).maybeSingle();
    expect(error).toBeNull();
    expect(data).toBeNull();
  });

  it("a user's update against another user's task affects no rows", async () => {
    const { data, error } = await clientA
      .from("task")
      .update({ title: "hijacked" })
      .eq("id", taskBId)
      .select();
    expect(error).toBeNull();
    expect(data).toEqual([]);

    const { data: stillIntact } = await clientB
      .from("task")
      .select("title")
      .eq("id", taskBId)
      .single();
    expect(stillIntact?.title).toBe("User B's task");
  });

  it("a user's delete against another user's task affects no rows", async () => {
    const { data, error } = await clientA.from("task").delete().eq("id", taskBId).select();
    expect(error).toBeNull();
    expect(data).toEqual([]);

    const { data: stillThere } = await clientB
      .from("task")
      .select("id")
      .eq("id", taskBId)
      .maybeSingle();
    expect(stillThere?.id).toBe(taskBId);
  });
});
