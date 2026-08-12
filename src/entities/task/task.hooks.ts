import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/api/supabase-client";
import { taskKeys } from "./task.data";
import { applyTaskChange } from "./task.utils";
import type { Task, TaskChange } from "./task.types";

const TASK_CHANGE_EVENTS = ["INSERT", "UPDATE", "DELETE"] as const;

// Keeps the cached board level with the database while the screen is open, so a
// task created, edited, moved or deleted in another tab or on another device
// shows up here without a reload. `ownerId` is passed in rather than read from
// the session entity, so this stays a task-only concern.
export function useTaskRealtimeSync(ownerId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!ownerId) return;

    let unmounted = false;
    // One channel per owner — the topic the task trigger broadcasts to, and the
    // only one the realtime.messages policy lets this user read (see the
    // task_realtime_broadcast migration).
    const channel = supabase.channel(`task:${ownerId}`, { config: { private: true } });

    for (const event of TASK_CHANGE_EVENTS) {
      channel.on<TaskChange>("broadcast", { event }, ({ payload }) => {
        // No invalidate: the broadcast carries the whole row, so a refetch would
        // only re-confirm what already arrived.
        queryClient.setQueryData<Task[]>(
          taskKeys.all,
          (tasks) => tasks && applyTaskChange(tasks, payload),
        );
      });
    }

    // Realtime Authorization runs the realtime.messages policy against this
    // JWT; without handing the socket the token first, the private join is
    // rejected outright.
    void supabase.realtime.setAuth().then(() => {
      if (unmounted) return;
      channel.subscribe((status) => {
        // Covers both gaps where a broadcast can pass the board by: the moment
        // between the initial fetch and the join, and any drop the socket
        // reconnects from — neither replays what was missed.
        if (status === "SUBSCRIBED") void queryClient.invalidateQueries({ queryKey: taskKeys.all });
      });
    });

    return () => {
      unmounted = true;
      void supabase.removeChannel(channel);
    };
  }, [ownerId, queryClient]);
}
