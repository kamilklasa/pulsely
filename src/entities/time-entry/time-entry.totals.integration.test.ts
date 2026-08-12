import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";
import { addDays, startOfDay, startOfWeek } from "@/shared/lib/calendar";
import { dayTotalMs, weekTotalMs } from "./time-entry.utils";
import type { TimeEntry } from "./time-entry.types";

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !anonKey || !serviceRoleKey) {
  throw new Error(
    "Missing Supabase env vars for the Seam B integration test — copy .env.example to .env.local",
  );
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

// The dashboard's totals are only as true as the rows they are computed over.
// Seam A proves the arithmetic; this proves it holds against timestamps that
// went through Postgres (`+00:00`, not `Z`) and came back through the same
// RLS-scoped select the data layer issues — so one user's hours can never turn
// up in another's day.
const ENTRY_COLUMNS = "id, task_id, started_at, stopped_at, source";

async function signInAsNewUser(): Promise<SupabaseClient> {
  const admin = createClient(supabaseUrl!, serviceRoleKey!);
  const email = `seam-b-totals-${crypto.randomUUID()}@example.com`;
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

async function logRun(
  client: SupabaseClient,
  taskId: string,
  startedAt: number,
  stoppedAt: number | null,
): Promise<void> {
  const { error } = await client.from("time_entry").insert({
    task_id: taskId,
    started_at: new Date(startedAt).toISOString(),
    stopped_at: stoppedAt === null ? null : new Date(stoppedAt).toISOString(),
  });
  if (error) throw error;
}

// Exactly the read the dashboard makes: every entry the caller owns, scoped by
// RLS rather than by a filter this client passes.
async function readOwnEntries(client: SupabaseClient): Promise<TimeEntry[]> {
  const { data, error } = await client
    .from("time_entry")
    .select(ENTRY_COLUMNS)
    .order("started_at", { ascending: true });
  if (error) throw error;
  return data as TimeEntry[];
}

// Seeded against the clock the test runs on, so "today" and "this week" mean the
// same thing here as they do on the dashboard, whatever day it is run.
const dayStart = startOfDay(Date.now());
const weekStart = startOfWeek(Date.now());

describe("day and week totals over stored entries (Seam B)", () => {
  let mine: SupabaseClient;
  let theirs: SupabaseClient;
  let runningStartedAt: number;

  beforeAll(async () => {
    [mine, theirs] = await Promise.all([signInAsNewUser(), signInAsNewUser()]);
    const [myTask, theirTask] = await Promise.all([
      createTask(mine, "Work of mine"),
      createTask(theirs, "Work of theirs"),
    ]);

    runningStartedAt = Date.now() - 10 * MINUTE;
    await Promise.all([
      // Banked earlier today.
      logRun(mine, myTask, dayStart + 9 * HOUR, dayStart + 10 * HOUR),
      // Last week, which neither total may reach back to.
      logRun(mine, myTask, addDays(weekStart, -3) + 9 * HOUR, addDays(weekStart, -3) + 12 * HOUR),
      // Eight hours belonging to somebody else, on the same day.
      logRun(theirs, theirTask, dayStart + 8 * HOUR, dayStart + 16 * HOUR),
    ]);
    // Opened after the rest: the partial unique index allows one open run per
    // owner, and the parallel inserts above would race it.
    await logRun(mine, myTask, runningStartedAt, null);
  });

  it("counts today's stored runs plus the one still open", async () => {
    const entries = await readOwnEntries(mine);
    const now = Date.now();

    const total = dayTotalMs(entries, now);

    // The banked hour is exact; the open run is measured against the clock, so
    // it is bounded rather than pinned to a number that ages between the two
    // statements.
    expect(total).toBeGreaterThanOrEqual(HOUR + (now - runningStartedAt));
    expect(total).toBeLessThan(HOUR + (now - runningStartedAt) + 5_000);
  });

  it("leaves last week's run out of both totals", async () => {
    const entries = await readOwnEntries(mine);
    const now = Date.now();

    // The three-hour run seeded three days before Monday is in the table and out
    // of the week — a week total that reached it would be an hour of drift the
    // dashboard could never explain.
    expect(entries).toHaveLength(3);
    expect(weekTotalMs(entries, now)).toBeLessThan(HOUR + (now - runningStartedAt) + 5_000);
    expect(weekTotalMs(entries, now)).toBeGreaterThanOrEqual(dayTotalMs(entries, now));
  });

  // The isolation that matters for a dashboard: their eight hours are stored,
  // and no query of mine can put them in my day. Asserted on the rows as well as
  // the total — a total that merely looks right could still have been summed
  // over somebody else's afternoon.
  it("never counts another user's time", async () => {
    const [entries, theirEntries] = await Promise.all([
      readOwnEntries(mine),
      readOwnEntries(theirs),
    ]);
    const now = Date.now();

    const theirIds = new Set(theirEntries.map((entry) => entry.id));
    expect(theirIds.size).toBe(1);
    expect(entries.filter((entry) => theirIds.has(entry.id))).toEqual([]);

    expect(dayTotalMs(entries, now)).toBeLessThan(2 * HOUR);
    expect(dayTotalMs(theirEntries, now)).toBe(8 * HOUR);
  });
});

// The two grouping edge cases from Seam A, this time on rows Postgres stored and
// served back: each gets its own account, so the boundary being asserted is the
// only thing in that account's totals.
describe("runs that cross a boundary, stored and read back (Seam B)", () => {
  it("gives today only the slice of an overnight run that fell after midnight", async () => {
    const client = await signInAsNewUser();
    const taskId = await createTask(client, "Worked past midnight");
    await logRun(client, taskId, dayStart - HOUR, dayStart + 30 * MINUTE);

    expect(dayTotalMs(await readOwnEntries(client), Date.now())).toBe(30 * MINUTE);
  });

  it("gives this week only the slice of a run that fell after Monday started", async () => {
    const client = await signInAsNewUser();
    const taskId = await createTask(client, "Worked into the new week");
    await logRun(client, taskId, weekStart - HOUR, weekStart + HOUR);

    expect(weekTotalMs(await readOwnEntries(client), Date.now())).toBe(HOUR);
  });
});
