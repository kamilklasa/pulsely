import { useEffect, useReducer } from "react";
import {
  findRunningEntry,
  taskElapsedMs,
  useStartTimer,
  useStopTimer,
  useTimeEntries,
} from "@/entities/time-entry";

export interface Stopwatch {
  elapsedMs: number;
  running: boolean;
  toggle: () => void;
}

// Fast enough that a running clock never looks like it skipped a second.
const RUNNING_TICK_MS = 200;

// Nothing changes in the data between a start and a stop, so something has to
// re-render the clock in between. Only the one running card and the status bar
// mount a tick, which is why an idle board schedules no timers at all.
function useTick(intervalMs: number | null): void {
  const [, tick] = useReducer((count: number) => count + 1, 0);

  useEffect(() => {
    if (intervalMs === null) return;
    const interval = window.setInterval(tick, intervalMs);
    return () => window.clearInterval(interval);
  }, [intervalMs]);
}

export function useStopwatch(taskId: string): Stopwatch {
  const { data: entries } = useTimeEntries();
  const startTimer = useStartTimer();
  const stopTimer = useStopTimer();

  const running = findRunningEntry(entries ?? [])?.task_id === taskId;
  useTick(running ? RUNNING_TICK_MS : null);

  return {
    running,
    elapsedMs: taskElapsedMs(entries ?? [], taskId, Date.now()),
    toggle: () => (running ? stopTimer.mutate() : startTimer.mutate(taskId)),
  };
}

// A total answers "how much today", so it moves for two reasons: the open run
// growing, and the day itself ending. The slow tick is the second one — a
// dashboard left open overnight has to stop labelling yesterday's hours "Today"
// on its own, which is why this never stands still the way a stopwatch does.
const IDLE_TICK_MS = 30_000;

// The clock everything measured against `now` reads from.
export function useLiveNow(): number {
  const { data: entries } = useTimeEntries();
  const running = findRunningEntry(entries ?? []) !== null;

  useTick(running ? RUNNING_TICK_MS : IDLE_TICK_MS);

  return Date.now();
}

export interface ActiveTimer {
  taskId: string;
  elapsedMs: number;
  stop: () => void;
}

export function useActiveTimer(): ActiveTimer | null {
  const { data: entries } = useTimeEntries();
  const stopTimer = useStopTimer();

  const running = findRunningEntry(entries ?? []);
  useTick(running === null ? null : RUNNING_TICK_MS);

  if (!running) return null;
  return {
    taskId: running.task_id,
    elapsedMs: taskElapsedMs(entries ?? [], running.task_id, Date.now()),
    stop: () => stopTimer.mutate(),
  };
}
