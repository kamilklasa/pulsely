export type TaskStatus = "backlog" | "this_week" | "today" | "done";

export const TASK_STATUSES: readonly TaskStatus[] = ["backlog", "this_week", "today", "done"];

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
