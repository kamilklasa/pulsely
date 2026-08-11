import { supabase } from "@/shared/api/supabase-client";
import { useTaskMutation, type TaskStatus } from "@/entities/task";

interface MoveTaskInput {
  id: string;
  status: TaskStatus;
}

export function useMoveTask() {
  return useTaskMutation(async ({ id, status }: MoveTaskInput) => {
    const { error } = await supabase.from("task").update({ status }).eq("id", id);
    if (error) throw error;
  });
}
