import { supabase } from "@/shared/api/supabase-client";
import { useTaskMutation } from "@/entities/task";
import type { TitleInput } from "./create-task.schema";

export function useCreateTask() {
  return useTaskMutation(async (title: TitleInput) => {
    const { error } = await supabase.from("task").insert({ title });
    if (error) throw error;
  });
}
