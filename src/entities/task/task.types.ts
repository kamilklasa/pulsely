export type TaskStatus = "backlog" | "this_week" | "today" | "done";

export const TASK_STATUSES: readonly TaskStatus[] = ["backlog", "this_week", "today", "done"];

// Shape of a realtime task broadcast — the `record`/`old_record` envelope
// `realtime.broadcast_changes()` builds in the task trigger (see the
// task_realtime_broadcast migration). A delete carries only `old_record`.
export interface TaskChange {
  operation: "INSERT" | "UPDATE" | "DELETE";
  record: Task | null;
  old_record: Task | null;
}

export interface Task {
  id: string;
  owner_id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  // Fractional rank within the column — see the add_task_sort_order migration.
  sort_order: number;
  created_at: string;
  updated_at: string;
}
