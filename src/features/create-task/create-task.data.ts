import { supabase } from "@/shared/api/supabase-client";
import { useTaskMutation, type TaskStatus } from "@/entities/task";
import type { TitleInput } from "./create-task.schema";

interface CreateTaskInput {
  title: TitleInput;
  status: TaskStatus;
}

export function useCreateTask() {
  return useTaskMutation(async ({ title, status }: CreateTaskInput) => {
    const { error } = await supabase.from("task").insert({ title, status });
    if (error) throw error;
  });
}
