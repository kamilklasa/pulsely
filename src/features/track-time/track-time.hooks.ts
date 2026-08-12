import { useEffect, useReducer } from "react";
import { useSelector } from "@tanstack/react-store";
import { startTracking, stopTracking, trackTimeStore } from "./track-time.store";

export interface Stopwatch {
  elapsedMs: number;
  running: boolean;
  toggle: () => void;
}

// The store only changes on start/stop, so something has to re-render the
// clock in between. Only the one running card and the status bar mount a tick,
// which is why an idle board schedules no timers at all.
function useTick(enabled: boolean): void {
  const [, tick] = useReducer((count: number) => count + 1, 0);

  useEffect(() => {
    if (!enabled) return;
    const interval = window.setInterval(tick, 200);
    return () => window.clearInterval(interval);
  }, [enabled]);
}

export function useStopwatch(taskId: string): Stopwatch {
  const active = useSelector(trackTimeStore, (state) => state.active);
  const totals = useSelector(trackTimeStore, (state) => state.totals);
  const running = active?.taskId === taskId;
  useTick(running);

  const banked = totals[taskId] ?? 0;

  return {
    running,
    elapsedMs: banked + (running && active ? Date.now() - active.startedAt : 0),
    toggle: () => (running ? stopTracking() : startTracking(taskId)),
  };
}

export function useActiveTimer(): { taskId: string; elapsedMs: number } | null {
  const active = useSelector(trackTimeStore, (state) => state.active);
  const totals = useSelector(trackTimeStore, (state) => state.totals);
  useTick(Boolean(active));

  if (!active) return null;
  return {
    taskId: active.taskId,
    elapsedMs: (totals[active.taskId] ?? 0) + (Date.now() - active.startedAt),
  };
}
