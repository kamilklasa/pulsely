import { Store } from "@tanstack/store";

interface ActiveTimer {
  taskId: string;
  startedAt: number;
}

interface TrackTimeState {
  active: ActiveTimer | null;
  // Milliseconds banked per task by runs that have already stopped.
  totals: Record<string, number>;
}

// Placeholder state: one running task at a time, all of it in memory, wiped by
// a reload. Persisted time entries replace this store — the components reading
// from it keep their shape. See the time-tracking issue.
//
// Only the task id is held, never its title: an edit while the clock runs would
// otherwise leave the status bar showing a name the board no longer uses, and a
// deleted task would strand a row that resolves to nothing.
export const trackTimeStore = new Store<TrackTimeState>({ active: null, totals: {} });

function bank(state: TrackTimeState): Record<string, number> {
  if (!state.active) return state.totals;
  const { taskId, startedAt } = state.active;
  return { ...state.totals, [taskId]: (state.totals[taskId] ?? 0) + (Date.now() - startedAt) };
}

// Starting a second task banks the first rather than running both: a person
// works on one thing at a time, and the eventual schema enforces the same rule
// with a partial unique index on the open entry.
export function startTracking(taskId: string): void {
  trackTimeStore.setState((state) => ({
    active: { taskId, startedAt: Date.now() },
    totals: bank(state),
  }));
}

export function stopTracking(): void {
  trackTimeStore.setState((state) =>
    state.active ? { active: null, totals: bank(state) } : state,
  );
}
