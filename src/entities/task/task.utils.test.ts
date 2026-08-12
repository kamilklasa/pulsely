import { describe, expect, it } from "vitest";
import { applyTaskChange, canTransition } from "./task.utils";
import { TASK_STATUSES, type Task, type TaskChange, type TaskStatus } from "./task.types";

const pairs = TASK_STATUSES.flatMap((from) =>
  TASK_STATUSES.map((to): [TaskStatus, TaskStatus] => [from, to]),
);

describe("canTransition", () => {
  it("rejects the one disallowed move: backlog straight to done", () => {
    expect(canTransition("backlog", "done")).toBe(false);
  });

  // The whole 4×4 grid, so a future column or a flipped comparison can't quietly
  // widen the rule beyond that single pair.
  it.each(pairs.filter(([from, to]) => !(from === "backlog" && to === "done")))(
    "allows %s → %s",
    (from, to) => {
      expect(canTransition(from, to)).toBe(true);
    },
  );

  it("allows every backward move, including reopening a finished task", () => {
    expect(canTransition("done", "today")).toBe(true);
    expect(canTransition("done", "this_week")).toBe(true);
    expect(canTransition("done", "backlog")).toBe(true);
  });

  // Reordering inside a column goes through the same move, so a status that
  // does not change has to stay legal — including backlog's.
  it("allows a task to stay in its own column", () => {
    for (const status of TASK_STATUSES) expect(canTransition(status, status)).toBe(true);
  });
});

function task(id: string, overrides: Partial<Task> = {}): Task {
  return {
    id,
    owner_id: "owner",
    title: id,
    description: null,
    status: "backlog",
    sort_order: 1,
    created_at: "2026-08-12T10:00:00.000Z",
    updated_at: "2026-08-12T10:00:00.000Z",
    ...overrides,
  };
}

function change(
  operation: TaskChange["operation"],
  record: Task | null,
  oldRecord: Task | null = null,
): TaskChange {
  return { operation, record, old_record: oldRecord };
}

describe("applyTaskChange", () => {
  const first = task("first", { sort_order: 1 });
  const second = task("second", { sort_order: 2 });

  it("adds a task the board has not seen yet", () => {
    const third = task("third", { sort_order: 3 });
    expect(applyTaskChange([first, second], change("INSERT", third))).toEqual([
      first,
      second,
      third,
    ]);
  });

  it("replaces a task it already holds instead of duplicating it", () => {
    const renamed = { ...second, title: "Renamed" };
    expect(applyTaskChange([first, second], change("UPDATE", renamed))).toEqual([first, renamed]);
  });

  it("removes the deleted task, which only ever arrives as the old row", () => {
    expect(applyTaskChange([first, second], change("DELETE", null, second))).toEqual([first]);
  });

  // The list feeds straight into groupByStatus, which trusts array order for
  // each column's ranking — so a realtime row has to land in the same place
  // the server's `order("sort_order")` would have put it.
  it("keeps the list ranked by sort_order after a move", () => {
    const moved = { ...second, status: "today" as TaskStatus, sort_order: 0.5 };
    expect(applyTaskChange([first, second], change("UPDATE", moved))).toEqual([moved, first]);
  });

  it("ignores a change that carries no row at all", () => {
    const tasks = [first, second];
    expect(applyTaskChange(tasks, change("INSERT", null))).toEqual(tasks);
    expect(applyTaskChange(tasks, change("DELETE", null, null))).toEqual(tasks);
  });

  it("leaves the cached array untouched", () => {
    const tasks = [first, second];
    applyTaskChange(tasks, change("DELETE", null, first));
    expect(tasks).toEqual([first, second]);
  });
});
