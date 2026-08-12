import type { TimeEntry } from "./time-entry.types";

// Seam A: everything below is a pure function over a list of entries, so the
// board's timer rules can be exercised without a database. The same functions
// patch the query cache optimistically, which is what keeps the button's
// response instant and the tested behaviour identical to the shipped one.

// The open entry — at most one per owner, guaranteed by the partial unique
// index in the create_time_entry migration.
export function findRunningEntry(entries: TimeEntry[]): TimeEntry | null {
  return entries.reduce<TimeEntry | null>((running, entry) => {
    if (entry.stopped_at !== null) return running;
    // A stale cache racing a second device is the only way two entries are open
    // at once; the newest run is the one the person is sitting in front of.
    return running === null || entry.started_at > running.started_at ? entry : running;
  }, null);
}

// Starting a task closes whatever was running rather than running both — a
// person works on one thing at a time. The previous run ends exactly where the
// new one begins, so no instant is counted twice and none is lost between them.
export function startTimer(entries: TimeEntry[], started: TimeEntry): TimeEntry[] {
  return [
    ...entries.map((entry) =>
      entry.stopped_at === null ? { ...entry, stopped_at: started.started_at } : entry,
    ),
    started,
  ];
}

export function stopTimer(entries: TimeEntry[], stoppedAt: string): TimeEntry[] {
  return entries.map((entry) =>
    entry.stopped_at === null ? { ...entry, stopped_at: stoppedAt } : entry,
  );
}

// Total time on a task: the runs that have ended, plus the live slice of the
// one still going — which is why this takes `now` and the UI re-renders it on a
// tick rather than storing a number that would go stale on the next frame.
export function taskElapsedMs(entries: TimeEntry[], taskId: string, now: number): number {
  return entries.reduce((total, entry) => {
    if (entry.task_id !== taskId) return total;
    const started = Date.parse(entry.started_at);
    const stopped = entry.stopped_at === null ? now : Date.parse(entry.stopped_at);
    // A clock that jumped backwards mid-run can store an end before its start.
    // That run is worth nothing; it must never eat into real tracked time.
    return total + Math.max(0, stopped - started);
  }, 0);
}
