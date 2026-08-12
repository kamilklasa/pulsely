import { describe, expect, it } from "vitest";
import {
  applyTimerStart,
  applyTimerStop,
  dayTotalMs,
  entryDurationMs,
  findRunningEntry,
  removeEntry,
  taskElapsedMs,
  taskEntriesNewestFirst,
  weekDayTotals,
  weekTotalMs,
} from "./time-entry.utils";
import type { TimeEntry } from "./time-entry.types";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
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

  // The two open entries in that race reach the cache by different routes:
  // Postgres serves `+00:00`, an optimistic entry writes `Z`. Compared as text
  // the older one would win, because "+" sorts below ".".
  it("ranks a server timestamp against an optimistic one by instant, not text", () => {
    const older = entry("older", { started_at: "2026-08-12T10:00:00+00:00", stopped_at: null });
    const newer = entry("newer", { started_at: "2026-08-12T10:05:00.000Z", stopped_at: null });
    expect(findRunningEntry([older, newer])).toEqual(newer);
    expect(findRunningEntry([newer, older])).toEqual(newer);
  });
});

describe("applyTimerStart (single-active-timer rule)", () => {
  const started = entry("new", { task_id: "task-b", started_at: at(5 * MINUTE), stopped_at: null });

  it("opens a running entry on the task", () => {
    expect(applyTimerStart([], started)).toEqual([started]);
  });

  // The rule the whole ticket turns on: a person works on one thing at a time,
  // so task A's clock is closed by the act of starting task B's.
  it("stops the timer running on another task", () => {
    const taskA = entry("task-a-run", { started_at: at(0), stopped_at: null });

    const result = applyTimerStart([taskA], started);

    expect(result).toEqual([{ ...taskA, stopped_at: started.started_at }, started]);
    expect(result.filter((candidate) => candidate.stopped_at === null)).toEqual([started]);
  });

  // No gap and no overlap: the minute that ends task A is the minute that
  // begins task B, so the two runs can never both count the same instant.
  it("closes the previous run at exactly the new one's start", () => {
    const taskA = entry("task-a-run", { started_at: at(0), stopped_at: null });
    expect(applyTimerStart([taskA], started)[0]?.stopped_at).toBe(at(5 * MINUTE));
  });

  it("closes the previous run even when it is on the same task", () => {
    const earlier = entry("earlier", { task_id: "task-b", started_at: at(0), stopped_at: null });

    const result = applyTimerStart([earlier], started);

    expect(result).toEqual([{ ...earlier, stopped_at: started.started_at }, started]);
  });

  it("leaves already-stopped entries alone", () => {
    const finished = entry("finished");
    expect(applyTimerStart([finished], started)).toEqual([finished, started]);
  });

  it("does not mutate the entries it was given", () => {
    const running = entry("running", { stopped_at: null });
    const entries = [running];

    applyTimerStart(entries, started);

    expect(entries).toEqual([running]);
    expect(running.stopped_at).toBeNull();
  });
});

describe("applyTimerStop", () => {
  it("stamps the running entry with the stop time", () => {
    const running = entry("running", { stopped_at: null });
    expect(applyTimerStop([running], at(3 * MINUTE))).toEqual([
      { ...running, stopped_at: at(3 * MINUTE) },
    ]);
  });

  it("leaves a list with nothing running untouched", () => {
    const entries = [entry("one"), entry("two")];
    expect(applyTimerStop(entries, at(3 * MINUTE))).toEqual(entries);
  });

  it("does not mutate the entries it was given", () => {
    const running = entry("running", { stopped_at: null });
    const entries = [running];

    applyTimerStop(entries, at(3 * MINUTE));

    expect(running.stopped_at).toBeNull();
  });
});

describe("entryDurationMs", () => {
  const now = BASE + 10 * MINUTE;

  it("measures a stopped run between its own timestamps", () => {
    expect(
      entryDurationMs(entry("done", { started_at: at(0), stopped_at: at(4 * MINUTE) }), now),
    ).toBe(4 * MINUTE);
  });

  // The one row in the list whose number has to move while you watch it.
  it("measures the open run against now", () => {
    expect(
      entryDurationMs(entry("running", { started_at: at(6 * MINUTE), stopped_at: null }), now),
    ).toBe(4 * MINUTE);
  });

  it("is zero for a run that ends before it starts", () => {
    expect(
      entryDurationMs(entry("skewed", { started_at: at(5 * MINUTE), stopped_at: at(0) }), now),
    ).toBe(0);
  });
});

describe("taskEntriesNewestFirst", () => {
  it("keeps only the entries on the task", () => {
    const mine = entry("mine");
    const result = taskEntriesNewestFirst([mine, entry("theirs", { task_id: "task-b" })], "task-a");
    expect(result).toEqual([mine]);
  });

  // The list reads top-down as "what I just did", so the newest run leads.
  it("orders the newest run first", () => {
    const older = entry("older", { started_at: at(0) });
    const newer = entry("newer", { started_at: at(5 * MINUTE) });
    expect(taskEntriesNewestFirst([older, newer], "task-a")).toEqual([newer, older]);
  });

  // Same trap findRunningEntry has: Postgres serves `+00:00`, an optimistic
  // entry writes `Z`, and "+" sorts below "." as text.
  it("orders by instant, not by timestamp text", () => {
    const older = entry("older", { started_at: "2026-08-12T10:00:00+00:00" });
    const newer = entry("newer", { started_at: "2026-08-12T10:05:00.000Z" });
    expect(taskEntriesNewestFirst([older, newer], "task-a")).toEqual([newer, older]);
  });

  it("does not reorder the entries it was given", () => {
    const older = entry("older", { started_at: at(0) });
    const newer = entry("newer", { started_at: at(5 * MINUTE) });
    const entries = [older, newer];

    taskEntriesNewestFirst(entries, "task-a");

    expect(entries).toEqual([older, newer]);
  });

  it("is empty for a task with no entries", () => {
    expect(taskEntriesNewestFirst([entry("theirs", { task_id: "task-b" })], "task-a")).toEqual([]);
  });
});

describe("removeEntry", () => {
  it("drops the entry with the given id", () => {
    const kept = entry("kept");
    expect(removeEntry([kept, entry("doomed")], "doomed")).toEqual([kept]);
  });

  it("leaves the list alone when the id is not in it", () => {
    const entries = [entry("one"), entry("two")];
    expect(removeEntry(entries, "three")).toEqual(entries);
  });

  it("does not mutate the entries it was given", () => {
    const entries = [entry("one"), entry("doomed")];

    removeEntry(entries, "doomed");

    expect(entries).toHaveLength(2);
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

// The dashboard answers "how much today", "how much this week" — questions about
// the person's own calendar, so every case below is built in the runner's local
// zone rather than in UTC. 10 August 2026 is a Monday; the week runs to Sunday.
function localIso(day: number, hour: number, minute = 0): string {
  return new Date(2026, 7, day, hour, minute).toISOString();
}

function localMs(day: number, hour: number, minute = 0): number {
  return new Date(2026, 7, day, hour, minute).getTime();
}

function run(
  id: string,
  startedDay: number,
  startedHour: number,
  stopped: [number, number] | null,
) {
  return entry(id, {
    started_at: localIso(startedDay, startedHour),
    stopped_at: stopped === null ? null : localIso(stopped[0], stopped[1]),
  });
}

// The two runs every grouping rule below turns on, each straddling a boundary
// with an hour on one side of it and half an hour on the other.
const OVERNIGHT = [
  entry("overnight", {
    started_at: localIso(11, 23),
    stopped_at: new Date(localMs(12, 0) + 30 * MINUTE).toISOString(),
  }),
];

const ACROSS_WEEKS = [
  entry("across-weeks", {
    started_at: localIso(9, 23),
    stopped_at: new Date(localMs(10, 0) + 30 * MINUTE).toISOString(),
  }),
];

// Wednesday afternoon, mid-week and mid-day, so "today" and "this week" both
// have room on either side of it.
const NOW = localMs(12, 15);

describe("dayTotalMs", () => {
  it("is zero with nothing tracked", () => {
    expect(dayTotalMs([], NOW)).toBe(0);
  });

  it("sums every run that started and ended today", () => {
    const entries = [run("morning", 12, 9, [12, 10]), run("afternoon", 12, 13, [12, 14])];
    expect(dayTotalMs(entries, NOW)).toBe(2 * HOUR);
  });

  it("ignores a run from another day", () => {
    expect(dayTotalMs([run("yesterday", 11, 9, [11, 12])], NOW)).toBe(0);
  });

  // The midnight case: a run that crosses into today belongs to both days, and
  // today may only claim the slice that actually fell after midnight.
  it("counts only the part of a run that fell after midnight", () => {
    expect(dayTotalMs(OVERNIGHT, NOW)).toBe(30 * MINUTE);
  });

  // The mirror of it: the slice before midnight is yesterday's, and asking about
  // yesterday must not hand back the whole run either.
  it("leaves the part before midnight on the earlier day", () => {
    expect(dayTotalMs(OVERNIGHT, localMs(11, 23) + 30 * MINUTE)).toBe(HOUR);
  });

  // What makes the dashboard tick rather than sit at the last stop: the open run
  // is measured against the clock, exactly as the card's total is.
  it("counts the open run up to now", () => {
    const entries = [run("banked", 12, 9, [12, 10]), run("running", 12, 14, null)];
    expect(dayTotalMs(entries, NOW)).toBe(2 * HOUR);
  });

  // A timer left running overnight: the day it is being read on gets its own
  // slice, not the whole run.
  it("counts only today's slice of a run left open since yesterday", () => {
    expect(dayTotalMs([run("forgotten", 11, 22, null)], NOW)).toBe(15 * HOUR);
  });

  it("counts a run that ends before it starts as nothing", () => {
    expect(dayTotalMs([run("skewed", 12, 14, [12, 9])], NOW)).toBe(0);
  });

  it("sums across tasks — the day is the whole board's, not one card's", () => {
    const entries = [
      run("task-a-run", 12, 9, [12, 10]),
      entry("task-b-run", {
        task_id: "task-b",
        started_at: localIso(12, 11),
        stopped_at: localIso(12, 12),
      }),
    ];
    expect(dayTotalMs(entries, NOW)).toBe(2 * HOUR);
  });
});

describe("weekTotalMs", () => {
  it("sums runs from Monday through the moment it is asked", () => {
    const entries = [run("monday", 10, 9, [10, 11]), run("wednesday", 12, 9, [12, 10])];
    expect(weekTotalMs(entries, NOW)).toBe(3 * HOUR);
  });

  // A run that straddles midnight is split across two days but stays whole
  // inside the week — the totals are not built by adding the daily ones up.
  it("keeps a run that crosses midnight whole", () => {
    expect(weekTotalMs(OVERNIGHT, NOW)).toBe(90 * MINUTE);
  });

  // The week boundary: Sunday night into Monday morning. The new week may only
  // claim the hours after Monday midnight, or every Monday would open with the
  // previous week's evening already on the clock.
  it("counts only the part of a run that fell after the week rolled over", () => {
    expect(weekTotalMs(ACROSS_WEEKS, NOW)).toBe(30 * MINUTE);
  });

  it("leaves the part before the rollover in the previous week", () => {
    expect(weekTotalMs(ACROSS_WEEKS, localMs(9, 23) + 30 * MINUTE)).toBe(HOUR);
  });

  // Sunday is the last day of the week, not the first: read on Sunday, Monday's
  // work is still part of the same week.
  it("still reaches back to Monday when read on the Sunday", () => {
    expect(weekTotalMs([run("monday", 10, 9, [10, 11])], localMs(16, 20))).toBe(2 * HOUR);
  });

  it("ignores last week's runs", () => {
    expect(weekTotalMs([run("last-week", 7, 9, [7, 17])], NOW)).toBe(0);
  });

  it("counts the open run up to now", () => {
    expect(weekTotalMs([run("running", 12, 14, null)], NOW)).toBe(HOUR);
  });
});

describe("weekDayTotals", () => {
  it("returns one bucket per day, Monday first", () => {
    const totals = weekDayTotals([], NOW);
    expect(totals).toHaveLength(7);
    expect(totals.map((day) => new Date(day.dayStart).getDay())).toEqual([1, 2, 3, 4, 5, 6, 0]);
    expect(totals[0]?.dayStart).toBe(localMs(10, 0));
  });

  it("files each run under the day it was worked", () => {
    const entries = [run("monday", 10, 9, [10, 11]), run("wednesday", 12, 9, [12, 10])];
    expect(weekDayTotals(entries, NOW).map((day) => day.totalMs)).toEqual([
      2 * HOUR,
      0,
      HOUR,
      0,
      0,
      0,
      0,
    ]);
  });

  // The split the bars have to show: an overnight run belongs to two columns,
  // and the pieces still add up to the run.
  it("splits a run that crosses midnight across both days", () => {
    const totals = weekDayTotals(OVERNIGHT, NOW);

    expect(totals.map((day) => day.totalMs)).toEqual([0, HOUR, 30 * MINUTE, 0, 0, 0, 0]);
    expect(totals.reduce((sum, day) => sum + day.totalMs, 0)).toBe(weekTotalMs(OVERNIGHT, NOW));
  });

  it("drops the slice that belongs to the previous week", () => {
    expect(weekDayTotals(ACROSS_WEEKS, NOW).map((day) => day.totalMs)).toEqual([
      30 * MINUTE,
      0,
      0,
      0,
      0,
      0,
      0,
    ]);
  });

  it("counts the open run up to now, leaving the rest of the day empty", () => {
    const totals = weekDayTotals([run("running", 12, 14, null)], NOW);
    expect(totals[2]?.totalMs).toBe(HOUR);
  });
});
