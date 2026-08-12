import * as v from "valibot";
import type { Task } from "./task.types";

// Shared by create-task and edit-task's schemas, which each wrap this with
// their own `TFunction<namespace>` closure for locale-correct messages.
export function requiredTitleSchema(message: string) {
  return v.pipe(v.string(), v.trim(), v.nonEmpty(message));
}

export function startOfToday(now = new Date()): Date {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  return start;
}

// Monday-first, matching both locales the app ships.
export function startOfWeek(now = new Date()): Date {
  const start = startOfToday(now);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return start;
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

// A finished task keeps no record of the bucket it came from, so it counts
// towards the day/week in which it was last written — moving a task to "done"
// is what stamps `updated_at`.
export function countDoneSince(doneTasks: Task[], since: Date): number {
  return doneTasks.filter((task) => new Date(task.updated_at) >= since).length;
}
