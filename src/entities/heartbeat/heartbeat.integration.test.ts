import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { serviceRoleClient, signInAsNewUser } from "@/shared/api/seam-b.utils";

const service = serviceRoleClient();

const USER_AGENT = "wakatime/v1.73.0 (darwin-23.0.0-arm64) go1.21.0 vscode/1.85.0";

// A task with one closed run, ready to hang heartbeats off.
async function seedRun(client: SupabaseClient) {
  const { data: user } = await client.auth.getUser();

  const { data: task, error: taskError } = await client
    .from("task")
    .insert({ title: "Ship the ingest function" })
    .select("id")
    .single();
  if (taskError) throw taskError;

  const { data: entry, error: entryError } = await client
    .from("time_entry")
    .insert({
      task_id: task.id,
      started_at: "2026-08-14T10:00:00.000Z",
      stopped_at: "2026-08-14T11:00:00.000Z",
    })
    .select("id")
    .single();
  if (entryError) throw entryError;

  return {
    ownerId: user.user!.id as string,
    taskId: task.id as string,
    entryId: entry.id as string,
  };
}

// Written the only way a heartbeat can be written: by the service role, standing
// in for the ingest function.
async function seedHeartbeat(run: { ownerId: string; entryId: string }, entity: string) {
  const { data, error } = await service
    .from("heartbeat")
    .insert({
      owner_id: run.ownerId,
      time_entry_id: run.entryId,
      time: "2026-08-14T10:30:00.000Z",
      entity,
      editor: "vscode",
      user_agent: USER_AGENT,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

// Seam B — real local Supabase (`supabase start`), no mocking. Heartbeats are the
// most sensitive rows in the schema: they say what a person was doing and when.
// The guarantee that only their owner can read them, and that nobody at all can
// forge or quietly edit them, is the database's to make.
describe("heartbeat (Seam B)", () => {
  it("keeps one owner's heartbeats out of another's reach", async () => {
    const alice = await signInAsNewUser("heartbeat-alice");
    const bob = await signInAsNewUser("heartbeat-bob");

    const aliceRun = await seedRun(alice);
    const bobRun = await seedRun(bob);
    const aliceHeartbeat = await seedHeartbeat(aliceRun, "src/alice.ts");
    await seedHeartbeat(bobRun, "src/bob.ts");

    const { data: aliceRows, error } = await alice.from("heartbeat").select("id, entity");
    expect(error).toBeNull();
    expect(aliceRows!.map((row) => row.id)).toEqual([aliceHeartbeat]);
    expect(aliceRows!.map((row) => row.entity)).toEqual(["src/alice.ts"]);

    // Naming Bob's row directly is no better than listing: RLS filters, it does
    // not merely hide a link.
    const { data: probed } = await alice.from("heartbeat").select("id").eq("id", aliceHeartbeat);
    expect(probed).toHaveLength(1);
    const { data: bobRows } = await bob.from("heartbeat").select("id, entity");
    expect(bobRows!.map((row) => row.entity)).toEqual(["src/bob.ts"]);
  });

  it("gives a signed-in client no way to write a heartbeat at all", async () => {
    const alice = await signInAsNewUser("heartbeat-insert");
    const run = await seedRun(alice);

    // The ingest function is the sole write path. If a client could insert, it
    // could file work against its own timer that never happened — and the per-app
    // split would be a claim rather than a record.
    const { error } = await alice.from("heartbeat").insert({
      owner_id: run.ownerId,
      time_entry_id: run.entryId,
      time: "2026-08-14T10:30:00.000Z",
      entity: "src/forged.ts",
      user_agent: USER_AGENT,
    });

    expect(error).not.toBeNull();
    expect(error!.code).toBe("42501");
  });

  it("gives no client a way to edit or prune its own history", async () => {
    const alice = await signInAsNewUser("heartbeat-mutate");
    const run = await seedRun(alice);
    const heartbeatId = await seedHeartbeat(run, "src/real.ts");

    const { error: updateError } = await alice
      .from("heartbeat")
      .update({ entity: "src/something-respectable.ts" })
      .eq("id", heartbeatId);
    expect(updateError!.code).toBe("42501");

    const { error: deleteError } = await alice.from("heartbeat").delete().eq("id", heartbeatId);
    expect(deleteError!.code).toBe("42501");

    // Still exactly as the function wrote it.
    const { data } = await alice.from("heartbeat").select("entity");
    expect(data!.map((row) => row.entity)).toEqual(["src/real.ts"]);
  });

  it("drops heartbeats with the run they describe", async () => {
    const alice = await signInAsNewUser("heartbeat-entry-cascade");
    const run = await seedRun(alice);
    await seedHeartbeat(run, "src/deleted-run.ts");

    // Deleting a mistaken run is a Phase 1 control. It has to take the detail of
    // that run with it, or the app keeps describing time it says it never tracked.
    const { error } = await alice.from("time_entry").delete().eq("id", run.entryId);
    expect(error).toBeNull();

    const { data } = await alice.from("heartbeat").select("id");
    expect(data).toEqual([]);
  });

  it("drops heartbeats when the task itself goes", async () => {
    const alice = await signInAsNewUser("heartbeat-task-cascade");
    const run = await seedRun(alice);
    await seedHeartbeat(run, "src/deleted-task.ts");

    // Two cascades deep: task → time_entry → heartbeat.
    const { error } = await alice.from("task").delete().eq("id", run.taskId);
    expect(error).toBeNull();

    const { data } = await alice.from("heartbeat").select("id");
    expect(data).toEqual([]);

    // Confirmed past RLS, so this is deletion rather than a row that merely
    // stopped being visible.
    const { data: remaining } = await service
      .from("heartbeat")
      .select("id")
      .eq("owner_id", run.ownerId);
    expect(remaining).toEqual([]);
  });
});
