import { describe, expect, it } from "vitest";
import { canTransition } from "./task.utils";
import { TASK_STATUSES, type TaskStatus } from "./task.types";

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
