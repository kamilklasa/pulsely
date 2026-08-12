import { addDays, DAYS_IN_WEEK, startOfDay, startOfWeek } from "@/shared/lib/calendar";
import type { DayTotal, TimeEntry } from "./time-entry.types";

// Seam A: everything below is a pure function over a list of entries, so the
// board's timer rules can be exercised without a database. The same functions
// patch the query cache optimistically, so the rules the tests cover are the
// ones the running board actually applies.

// The open entry — at most one per owner, guaranteed by the partial unique
// index in the create_time_entry migration.
export function findRunningEntry(entries: TimeEntry[]): TimeEntry | null {
  return entries.reduce<TimeEntry | null>((running, entry) => {
    if (entry.stopped_at !== null) return running;
    // Parsed, never compared as text: Postgres hands back `+00:00` where an
    // optimistic entry writes `Z`, and `'+' < '.'` would rank the two wrong for
    // the same instant.
    if (running === null) return entry;
    // A stale cache racing a second device is the only way two entries are open
    // at once; the newest run is the one the person is sitting in front of.
    return Date.parse(entry.started_at) > Date.parse(running.started_at) ? entry : running;
  }, null);
}

// Starting a task closes whatever was running rather than running both — a
// person works on one thing at a time. The previous run ends exactly where the
// new one begins, so no instant is counted twice and none is lost between them.
export function applyTimerStart(entries: TimeEntry[], started: TimeEntry): TimeEntry[] {
  return [...applyTimerStop(entries, started.started_at), started];
}

export function applyTimerStop(entries: TimeEntry[], stoppedAt: string): TimeEntry[] {
  return entries.map((entry) =>
    entry.stopped_at === null ? { ...entry, stopped_at: stoppedAt } : entry,
  );
}

// Removing a mistaken run. Kept here rather than inline in the mutation so the
// optimistic patch and the row the list drops are the same operation.
export function removeEntry(entries: TimeEntry[], entryId: string): TimeEntry[] {
  return entries.filter((entry) => entry.id !== entryId);
}

// One run's length: a stopped run is measured between its own timestamps, the
// open one against the clock — which is what makes its row tick.
export function entryDurationMs(entry: TimeEntry, now: number): number {
  const started = Date.parse(entry.started_at);
  const stopped = entry.stopped_at === null ? now : Date.parse(entry.stopped_at);
  // A clock that jumped backwards mid-run can store an end before its start.
  // That run is worth nothing; it must never eat into real tracked time.
  return Math.max(0, stopped - started);
}

// The task's own runs, newest first — the order the details list reads in.
// Sorted on a copy: the cached array belongs to the query, not to a render.
export function taskEntriesNewestFirst(entries: TimeEntry[], taskId: string): TimeEntry[] {
  return entries
    .filter((entry) => entry.task_id === taskId)
    .sort((a, b) => Date.parse(b.started_at) - Date.parse(a.started_at));
}

// Total time on a task: the runs that have ended, plus the live slice of the
// one still going — which is why this takes `now` and the UI re-renders it on a
// tick rather than storing a number that would go stale on the next frame.
export function taskElapsedMs(entries: TimeEntry[], taskId: string, now: number): number {
  return entries.reduce(
    (total, entry) => (entry.task_id === taskId ? total + entryDurationMs(entry, now) : total),
    0,
  );
}

// A run's overlap with a window, which is what makes a run that crosses midnight
// count on both days without either day claiming the whole of it. The open run
// is measured against the clock here too, so the totals move while it runs.
export function entryMsWithin(
  entry: TimeEntry,
  rangeStart: number,
  rangeEnd: number,
  now: number,
): number {
  const started = Date.parse(entry.started_at);
  const stopped = entry.stopped_at === null ? now : Date.parse(entry.stopped_at);
  // Max(0, …) covers both a run outside the window entirely and one stored by a
  // clock that jumped backwards mid-run; neither may eat into real tracked time.
  return Math.max(0, Math.min(stopped, rangeEnd) - Math.max(started, rangeStart));
}

export function totalMsWithin(
  entries: TimeEntry[],
  rangeStart: number,
  rangeEnd: number,
  now: number,
): number {
  return entries.reduce(
    (total, entry) => total + entryMsWithin(entry, rangeStart, rangeEnd, now),
    0,
  );
}

export function dayTotalMs(entries: TimeEntry[], now: number): number {
  const dayStart = startOfDay(now);
  return totalMsWithin(entries, dayStart, addDays(dayStart, 1), now);
}

// Not the sum of the daily totals below: a run crossing midnight is split across
// two days but stays whole inside the week, and summing rounded-off days would
// be a second, quietly different answer.
export function weekTotalMs(entries: TimeEntry[], now: number): number {
  const weekStart = startOfWeek(now);
  return totalMsWithin(entries, weekStart, addDays(weekStart, DAYS_IN_WEEK), now);
}

// One bucket per day of the current week, Monday first — including the days with
// nothing on them, so the chart keeps a fixed set of columns as the week fills.
export function weekDayTotals(entries: TimeEntry[], now: number): DayTotal[] {
  const weekStart = startOfWeek(now);

  return Array.from({ length: DAYS_IN_WEEK }, (_, index) => {
    const dayStart = addDays(weekStart, index);
    return {
      dayStart,
      totalMs: totalMsWithin(entries, dayStart, addDays(dayStart, 1), now),
    };
  });
}
