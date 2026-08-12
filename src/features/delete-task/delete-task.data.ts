import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/api/supabase-client";
import { useTaskMutation } from "@/entities/task";
import { timeEntryKeys } from "@/entities/time-entry";

export function useDeleteTask() {
  const queryClient = useQueryClient();

  return useTaskMutation(async (id: string) => {
    const { error } = await supabase.from("task").delete().eq("id", id);
    if (error) throw error;

    // Postgres cascades the task's time entries, but nothing tells the cache
    // that: a timer left running on a deleted task would otherwise keep a tick
    // scheduled against a row that no longer exists.
    await queryClient.invalidateQueries({ queryKey: timeEntryKeys.all });
  });
}
