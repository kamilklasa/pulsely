import { type SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";
import { signInAsNewUser } from "@/shared/api/seam-b.utils";

// Seam B — real local Supabase (`supabase start`), no mocking. The point is proving RLS actually
// holds; a mocked client can't demonstrate that. Sign-in (and the clock preflight that keeps a
// drifted Docker VM from looking like a test failure) lives in the shared Seam B helper.

describe("task CRUD + RLS isolation (Seam B)", () => {
  let clientA: SupabaseClient;
  let clientB: SupabaseClient;
  let taskAId: string;
  let taskBId: string;

  beforeAll(async () => {
    [clientA, clientB] = await Promise.all([signInAsNewUser("task"), signInAsNewUser("task")]);

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
