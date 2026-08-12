import { supabase } from "@/shared/api/supabase-client";
import { useTaskMutation } from "@/entities/task";

export function useDeleteTask() {
  return useTaskMutation(async (id: string) => {
    const { error } = await supabase.from("task").delete().eq("id", id);
    if (error) throw error;
  });
}
