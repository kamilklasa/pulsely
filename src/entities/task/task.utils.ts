import * as v from "valibot";
import { startOfDay, startOfWeek as startOfCalendarWeek } from "@/shared/lib/calendar";
import type { Task, TaskChange, TaskStatus } from "./task.types";

// The board's one transition rule: a task can't jump from the backlog straight
// to done, because that hides work nobody ever picked up. Everything else is
// allowed — backward moves included, so a finished task can be reopened freely.
export function canTransition(from: TaskStatus, to: TaskStatus): boolean {
  return !(from === "backlog" && to === "done");
}

// Shared by create-task and edit-task's schemas, which each wrap this with
// their own `TFunction<namespace>` closure for locale-correct messages.
export function requiredTitleSchema(message: string) {
  return v.pipe(v.string(), v.trim(), v.nonEmpty(message));
}

// Both boundaries come from the shared calendar rather than being computed here:
// the time dashboard reports on the same "today" and "this week" the columns
// count against, and two implementations of Monday would eventually drift.
export function startOfToday(now = new Date()): Date {
  return new Date(startOfDay(now.getTime()));
}

export function startOfWeek(now = new Date()): Date {
  return new Date(startOfCalendarWeek(now.getTime()));
}

// Rank for a card dropped between `before` and `after` (either side missing =
// dropped at that end of the column). Midpoints keep every other row untouched;
// ~50 splits of the same gap is where float64 runs out of room, which no
// hand-sorted column reaches.
export function sortOrderBetween(before: Task | undefined, after: Task | undefined): number {
  if (before && after) return (before.sort_order + after.sort_order) / 2;
  if (before) return before.sort_order + 1;
  if (after) return after.sort_order - 1;
  return Date.now() / 1000;
}

// Folds a realtime change into the cached board instead of refetching it: the
// broadcast already carries the whole row, so a round-trip would only confirm
// what the payload says. Re-sorted on every write because the cached array's
// order *is* each column's ranking (groupByStatus preserves it), so a row that
// moved has to land where the server's `order("sort_order")` would put it.
export function applyTaskChange(tasks: Task[], change: TaskChange): Task[] {
  if (change.operation === "DELETE") {
    const removedId = change.old_record?.id;
    return removedId ? tasks.filter((task) => task.id !== removedId) : tasks;
  }

  const { record } = change;
  if (!record) return tasks;
  return [...tasks.filter((task) => task.id !== record.id), record].sort(
    (a, b) => a.sort_order - b.sort_order,
  );
}

// A finished task keeps no record of the bucket it came from, so it counts
// towards the day/week in which it was last written — moving a task to "done"
// is what stamps `updated_at`.
export function countDoneSince(doneTasks: Task[], since: Date): number {
  return doneTasks.filter((task) => new Date(task.updated_at) >= since).length;
}
