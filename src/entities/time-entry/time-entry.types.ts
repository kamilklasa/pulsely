// `manual` is the only source Phase 1 writes; the column exists now so Phase 2's
// WakaTime import has somewhere to land without a schema redefinition.
export type TimeEntrySource = "manual" | "wakatime";

// One day of the week the dashboard charts: the day's own midnight, and every
// tracked millisecond that fell inside it.
export interface DayTotal {
  dayStart: number;
  totalMs: number;
}

// Deliberately narrower than the table: the client never reads `owner_id`
// (Postgres fills it and RLS enforces it), and leaving it out is what lets an
// optimistic entry be built locally without first asking who is signed in.
export interface TimeEntry {
  id: string;
  task_id: string;
  started_at: string;
  // Null while the timer is running — the one open entry per owner.
  stopped_at: string | null;
  source: TimeEntrySource;
}
