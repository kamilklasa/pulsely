import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/api/supabase-client";
import type { Task } from "./task.types";

export const taskKeys = {
  all: ["tasks"] as const,
};

export function useTasks() {
  return useQuery({
    queryKey: taskKeys.all,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as Task[];
    },
  });
}

// Every task write (create/edit/delete/move) follows the same shape — mutate,
// then invalidate the board's query — so features share this instead of each
// repeating useMutation + invalidateQueries.
export function useTaskMutation<TVariables>(mutationFn: (variables: TVariables) => Promise<void>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: taskKeys.all });
    },
  });
}
