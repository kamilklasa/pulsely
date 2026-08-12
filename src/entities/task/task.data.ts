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
        // A single global sort is enough: groupByStatus keeps the array order,
        // so each column comes out ranked without a per-column query.
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data as Task[];
    },
  });
}

interface TaskMutationOptions<TVariables, TContext> {
  // Optional optimistic-update pair (e.g. move-task patches the cache
  // immediately so a drag's drop animation has something correct to land
  // on, instead of waiting out the Supabase round-trip). Omit for mutations
  // that don't need it — the invalidate-on-settle below is enough on its own.
  onMutate?: (variables: TVariables) => TContext | Promise<TContext>;
  onError?: (error: unknown, variables: TVariables, context: TContext | undefined) => void;
}

// Every task write (create/edit/delete/move) invalidates the board's query
// once it settles, so features share this instead of each repeating that
// wiring — invalidating on settle (not just success) also re-syncs after an
// optimistic update rolls back.
export function useTaskMutation<TVariables, TContext = undefined>(
  mutationFn: (variables: TVariables) => Promise<void>,
  options?: TaskMutationOptions<TVariables, TContext>,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onMutate: options?.onMutate,
    onError: options?.onError,
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: taskKeys.all });
    },
  });
}
