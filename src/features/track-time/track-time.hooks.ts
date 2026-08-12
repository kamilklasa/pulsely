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

// Nothing changes in the data between a start and a stop, so something has to
// re-render the clock in between. Only the one running card and the status bar
// mount a tick, which is why an idle board schedules no timers at all.
function useTick(enabled: boolean): void {
  const [, tick] = useReducer((count: number) => count + 1, 0);

  useEffect(() => {
    if (!enabled) return;
    const interval = window.setInterval(tick, 200);
    return () => window.clearInterval(interval);
  }, [enabled]);
}

export function useStopwatch(taskId: string): Stopwatch {
  const { data: entries } = useTimeEntries();
  const startTimer = useStartTimer();
  const stopTimer = useStopTimer();

  const running = findRunningEntry(entries ?? [])?.task_id === taskId;
  useTick(running);

  return {
    running,
    elapsedMs: taskElapsedMs(entries ?? [], taskId, Date.now()),
    toggle: () => (running ? stopTimer.mutate() : startTimer.mutate(taskId)),
  };
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
  useTick(running !== null);

  if (!running) return null;
  return {
    taskId: running.task_id,
    elapsedMs: taskElapsedMs(entries ?? [], running.task_id, Date.now()),
    stop: () => stopTimer.mutate(),
  };
}
