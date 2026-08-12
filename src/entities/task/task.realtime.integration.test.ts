import { createClient, type RealtimeChannel, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { TaskChange } from "./task.types";

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !anonKey || !serviceRoleKey) {
  throw new Error(
    "Missing Supabase env vars for the Seam B realtime test — copy .env.example to .env.local",
  );
}

interface SignedInUser {
  client: SupabaseClient;
  id: string;
}

// Same magic-link redemption as task.integration.test.ts — the point of Seam B is that nothing is
// mocked, so the realtime authorization check runs against a real JWT.
async function signInAsNewUser(): Promise<SignedInUser> {
  const admin = createClient(supabaseUrl!, serviceRoleKey!);
  const email = `seam-b-realtime-${crypto.randomUUID()}@example.com`;
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (linkError) throw linkError;

  const client = createClient(supabaseUrl!, anonKey!);
  const { data, error: verifyError } = await client.auth.verifyOtp({
    email,
    token: linkData.properties!.email_otp!,
    type: "email",
  });
  if (verifyError) throw verifyError;

  return { client, id: data.user!.id };
}

// Collects every task change that reaches one user's channel, so a test can both wait for the ones
// it expects and assert that nothing else showed up.
async function subscribeToTaskChanges(user: SignedInUser): Promise<{
  channel: RealtimeChannel;
  received: TaskChange[];
  waitForCount: (count: number) => Promise<void>;
}> {
  const received: TaskChange[] = [];
  await user.client.realtime.setAuth();

  const channel = user.client.channel(`task:${user.id}`, { config: { private: true } });
  for (const event of ["INSERT", "UPDATE", "DELETE"]) {
    channel.on("broadcast", { event }, ({ payload }) => received.push(payload as TaskChange));
  }

  await new Promise<void>((resolve, reject) => {
    channel.subscribe((status, error) => {
      if (status === "SUBSCRIBED") resolve();
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        reject(error ?? new Error(status));
      }
    });
  });

  return { channel, received, waitForCount: (count) => waitFor(() => received.length >= count) };
}

async function waitFor(condition: () => boolean, timeoutMs = 5000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!condition()) {
    if (Date.now() > deadline) throw new Error("Timed out waiting for a realtime broadcast");
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

// Broadcasts are asynchronous by nature, so "nothing arrived" can only be asserted after giving the
// server a fair chance to deliver something. Long enough to be meaningful, short enough to keep the
// suite quick.
const SILENCE_WINDOW_MS = 1500;

describe("realtime task sync (Seam B)", () => {
  let userA: SignedInUser;
  let userB: SignedInUser;
  let subscription: Awaited<ReturnType<typeof subscribeToTaskChanges>>;

  beforeAll(async () => {
    [userA, userB] = await Promise.all([signInAsNewUser(), signInAsNewUser()]);
    subscription = await subscribeToTaskChanges(userA);
  });

  afterAll(async () => {
    await userA.client.removeAllChannels();
  });

  it("broadcasts a user's own insert, update and delete to their own channel", async () => {
    const { data: created, error } = await userA.client
      .from("task")
      .insert({ title: "Realtime task" })
      .select()
      .single();
    expect(error).toBeNull();

    await userA.client.from("task").update({ status: "today" }).eq("id", created.id);
    await userA.client.from("task").delete().eq("id", created.id);

    await subscription.waitForCount(3);
    const [insert, update, remove] = subscription.received;

    expect(insert.operation).toBe("INSERT");
    expect(insert.record).toMatchObject({ id: created.id, title: "Realtime task" });

    expect(update.operation).toBe("UPDATE");
    expect(update.record).toMatchObject({ id: created.id, status: "today" });

    // Deletes are the case a postgres_changes subscription cannot serve safely, so this asserts the
    // whole row is there — that is what lets the board drop the card without a refetch.
    expect(remove.operation).toBe("DELETE");
    expect(remove.record).toBeNull();
    expect(remove.old_record).toMatchObject({ id: created.id, title: "Realtime task" });
  });

  it("never delivers another user's task changes", async () => {
    const before = subscription.received.length;

    const { data: theirs } = await userB.client
      .from("task")
      .insert({ title: "User B's private task" })
      .select()
      .single();
    await userB.client.from("task").update({ status: "done" }).eq("id", theirs.id);
    await userB.client.from("task").delete().eq("id", theirs.id);

    await new Promise((resolve) => setTimeout(resolve, SILENCE_WINDOW_MS));
    expect(subscription.received.slice(before)).toEqual([]);
  });

  // Generous timeout: a rejected join surfaces only once realtime-js gives up waiting on its push,
  // which is a fixed ~5s — the denial itself is immediate, the client just doesn't hear about it.
  it("refuses to subscribe a user to another user's task channel", async () => {
    await userA.client.realtime.setAuth();
    const channel = userA.client.channel(`task:${userB.id}`, { config: { private: true } });

    const [status, error] = await new Promise<[string, Error | undefined]>((resolve) => {
      channel.subscribe((subscribeStatus, subscribeError) =>
        resolve([subscribeStatus, subscribeError]),
      );
    });

    expect(status).toBe("CHANNEL_ERROR");
    expect(error?.message).toContain("Unauthorized");
    await userA.client.removeChannel(channel);
  }, 15_000);
});
