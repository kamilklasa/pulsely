import { supabase } from "@/shared/api/supabase-client";
import { useTaskMutation } from "@/entities/task";

interface UpdateTaskInput {
  id: string;
  title: string;
  description: string;
}

export function useUpdateTask() {
  return useTaskMutation(async ({ id, title, description }: UpdateTaskInput) => {
    const { error } = await supabase
      .from("task")
      .update({ title, description: description.length > 0 ? description : null })
      .eq("id", id);
    if (error) throw error;
  });
}
