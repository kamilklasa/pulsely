import { describe, expect, it } from "vitest";
import { findRunningEntry, startTimer, stopTimer, taskElapsedMs } from "./time-entry.utils";
import type { TimeEntry } from "./time-entry.types";

const MINUTE = 60_000;
const BASE = Date.parse("2026-08-12T10:00:00.000Z");

function at(offsetMs: number): string {
  return new Date(BASE + offsetMs).toISOString();
}

function entry(id: string, overrides: Partial<TimeEntry> = {}): TimeEntry {
  return {
    id,
    task_id: "task-a",
    started_at: at(0),
    stopped_at: at(MINUTE),
    source: "manual",
    ...overrides,
  };
}

describe("findRunningEntry", () => {
  it("finds the entry that has not been stopped", () => {
    const running = entry("running", { stopped_at: null });
    expect(findRunningEntry([entry("done"), running])).toEqual(running);
  });

  it("returns null when every entry is stopped", () => {
    expect(findRunningEntry([entry("one"), entry("two")])).toBeNull();
  });

  it("returns null for an empty list", () => {
    expect(findRunningEntry([])).toBeNull();
  });

  // Two open entries can only come from a stale cache racing a second device;
  // the newest run is the one the person is actually sitting in front of.
  it("picks the most recently started when more than one is open", () => {
    const older = entry("older", { started_at: at(0), stopped_at: null });
    const newer = entry("newer", { started_at: at(MINUTE), stopped_at: null });
    expect(findRunningEntry([newer, older])).toEqual(newer);
  });
});

describe("startTimer (single-active-timer rule)", () => {
  const started = entry("new", { task_id: "task-b", started_at: at(5 * MINUTE), stopped_at: null });

  it("opens a running entry on the task", () => {
    expect(startTimer([], started)).toEqual([started]);
  });

  // The rule the whole ticket turns on: a person works on one thing at a time,
  // so task A's clock is closed by the act of starting task B's.
  it("stops the timer running on another task", () => {
    const taskA = entry("task-a-run", { started_at: at(0), stopped_at: null });

    const result = startTimer([taskA], started);

    expect(result).toEqual([{ ...taskA, stopped_at: started.started_at }, started]);
    expect(result.filter((candidate) => candidate.stopped_at === null)).toEqual([started]);
  });

  // No gap and no overlap: the minute that ends task A is the minute that
  // begins task B, so the two runs can never both count the same instant.
  it("closes the previous run at exactly the new one's start", () => {
    const taskA = entry("task-a-run", { started_at: at(0), stopped_at: null });
    expect(startTimer([taskA], started)[0]?.stopped_at).toBe(at(5 * MINUTE));
  });

  it("closes the previous run even when it is on the same task", () => {
    const earlier = entry("earlier", { task_id: "task-b", started_at: at(0), stopped_at: null });

    const result = startTimer([earlier], started);

    expect(result).toEqual([{ ...earlier, stopped_at: started.started_at }, started]);
  });

  it("leaves already-stopped entries alone", () => {
    const finished = entry("finished");
    expect(startTimer([finished], started)).toEqual([finished, started]);
  });

  it("does not mutate the entries it was given", () => {
    const running = entry("running", { stopped_at: null });
    const entries = [running];

    startTimer(entries, started);

    expect(entries).toEqual([running]);
    expect(running.stopped_at).toBeNull();
  });
});

describe("stopTimer", () => {
  it("stamps the running entry with the stop time", () => {
    const running = entry("running", { stopped_at: null });
    expect(stopTimer([running], at(3 * MINUTE))).toEqual([
      { ...running, stopped_at: at(3 * MINUTE) },
    ]);
  });

  it("leaves a list with nothing running untouched", () => {
    const entries = [entry("one"), entry("two")];
    expect(stopTimer(entries, at(3 * MINUTE))).toEqual(entries);
  });

  it("does not mutate the entries it was given", () => {
    const running = entry("running", { stopped_at: null });
    const entries = [running];

    stopTimer(entries, at(3 * MINUTE));

    expect(running.stopped_at).toBeNull();
  });
});

describe("taskElapsedMs", () => {
  const now = BASE + 10 * MINUTE;

  it("is zero for a task with no entries", () => {
    expect(taskElapsedMs([entry("other", { task_id: "task-b" })], "task-a", now)).toBe(0);
  });

  it("sums every stopped run on the task", () => {
    const entries = [
      entry("one", { started_at: at(0), stopped_at: at(MINUTE) }),
      entry("two", { started_at: at(2 * MINUTE), stopped_at: at(4 * MINUTE) }),
    ];
    expect(taskElapsedMs(entries, "task-a", now)).toBe(3 * MINUTE);
  });

  // What makes the number on a running card move: the open run is measured
  // against the clock rather than a stored end.
  it("counts the open run up to now", () => {
    const entries = [
      entry("banked", { started_at: at(0), stopped_at: at(MINUTE) }),
      entry("running", { started_at: at(8 * MINUTE), stopped_at: null }),
    ];
    expect(taskElapsedMs(entries, "task-a", now)).toBe(3 * MINUTE);
  });

  it("ignores other tasks' time", () => {
    const entries = [
      entry("mine", { started_at: at(0), stopped_at: at(MINUTE) }),
      entry("theirs", { task_id: "task-b", started_at: at(0), stopped_at: at(9 * MINUTE) }),
    ];
    expect(taskElapsedMs(entries, "task-a", now)).toBe(MINUTE);
  });

  // A device whose clock jumped backwards mid-run can store an end before its
  // start; that run is worth nothing, never a negative that eats real time.
  it("counts a run that ends before it starts as zero", () => {
    const entries = [
      entry("skewed", { started_at: at(5 * MINUTE), stopped_at: at(0) }),
      entry("real", { started_at: at(0), stopped_at: at(MINUTE) }),
    ];
    expect(taskElapsedMs(entries, "task-a", now)).toBe(MINUTE);
  });
});
