import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/api/supabase-client";
import { taskKeys, useTaskMutation, type Task, type TaskStatus } from "@/entities/task";

interface MoveTaskInput {
  id: string;
  status: TaskStatus;
  // Omitted by the status select, which only changes the column and leaves the
  // card wherever its existing rank puts it; the board's drag-and-drop sets it.
  sortOrder?: number;
}

interface MoveTaskContext {
  previousTasks: Task[] | undefined;
}

export function useMoveTask() {
  const queryClient = useQueryClient();

  return useTaskMutation<MoveTaskInput, MoveTaskContext>(
    async ({ id, status, sortOrder }) => {
      const { error } = await supabase
        .from("task")
        .update(sortOrder === undefined ? { status } : { status, sort_order: sortOrder })
        .eq("id", id);
      if (error) throw error;
    },
    {
      // Patches the cache synchronously (no `await` before setQueryData) so
      // it lands in the same render as the drag-end state update — the
      // drop animation measures the card's final position on the next
      // frame, so it needs to already be in its new column by then, not
      // one tick later, or it flies back to the stale (pre-move) spot.
      onMutate: ({ id, status, sortOrder }) => {
        void queryClient.cancelQueries({ queryKey: taskKeys.all });
        const previousTasks = queryClient.getQueryData<Task[]>(taskKeys.all);
        queryClient.setQueryData<Task[]>(taskKeys.all, (tasks) =>
          tasks
            ?.map((task) =>
              task.id === id ? { ...task, status, sort_order: sortOrder ?? task.sort_order } : task,
            )
            // Mirrors the server's `order("sort_order")` so the re-ranked card
            // shows up in its new slot, not at its old array index.
            .sort((a, b) => a.sort_order - b.sort_order),
        );
        return { previousTasks };
      },
      onError: (_error, _variables, context) => {
        if (context?.previousTasks) queryClient.setQueryData(taskKeys.all, context.previousTasks);
      },
    },
  );
}
