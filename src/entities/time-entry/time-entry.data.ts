import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/api/supabase-client";
import { applyTimerStart, applyTimerStop, removeEntry } from "./time-entry.utils";
import type { TimeEntry } from "./time-entry.types";

export const timeEntryKeys = {
  all: ["time-entries"] as const,
};

// Named columns rather than `*`: owner_id is the server's business (see
// TimeEntry), and leaving it out of the shape is what lets an optimistic entry
// be assembled here without first resolving who is signed in.
const ENTRY_COLUMNS = "id, task_id, started_at, stopped_at, source";

// One query for every entry the user owns, not one per card: the board shows a
// total on all of them at once, and RLS already scopes the rows to this account.
export function useTimeEntries() {
  return useQuery({
    queryKey: timeEntryKeys.all,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("time_entry")
        .select(ENTRY_COLUMNS)
        .order("started_at", { ascending: true });
      if (error) throw error;
      return data as TimeEntry[];
    },
  });
}

interface TimeEntryMutationContext {
  previousEntries: TimeEntry[] | undefined;
}

// Both timer writes patch the cache before the round-trip: a start/stop button
// that waits on the network reads as a broken clock, since the elapsed time is
// meant to start moving the instant it is pressed. The patch applies the same
// pure function the Seam A tests cover, so the board never shows a state the
// rules wouldn't produce — only a start time a few milliseconds ahead of the
// stored one, which the invalidate on settle corrects.
function useTimeEntryMutation<TVariables>(
  mutationFn: (variables: TVariables) => Promise<void>,
  patch: (entries: TimeEntry[], variables: TVariables) => TimeEntry[],
) {
  const queryClient = useQueryClient();

  return useMutation<void, unknown, TVariables, TimeEntryMutationContext>({
    mutationFn,
    onMutate: (variables) => {
      void queryClient.cancelQueries({ queryKey: timeEntryKeys.all });
      const previousEntries = queryClient.getQueryData<TimeEntry[]>(timeEntryKeys.all);
      queryClient.setQueryData<TimeEntry[]>(timeEntryKeys.all, (entries) =>
        patch(entries ?? [], variables),
      );
      return { previousEntries };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousEntries) {
        queryClient.setQueryData(timeEntryKeys.all, context.previousEntries);
      }
    },
    // On settle, not just success, so a rolled-back optimistic patch re-syncs
    // with what the database actually holds.
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: timeEntryKeys.all });
    },
  });
}

export function useStartTimer() {
  return useTimeEntryMutation(
    async (taskId: string) => {
      const startedAt = new Date().toISOString();

      // The single-active-timer rule, applied to the database: close the open
      // run before opening the next. Filtered on `stopped_at is null` rather
      // than on an id this tab knows, so a run started on another device is
      // closed too — and closing it at the new run's start keeps the two from
      // ever counting the same instant.
      const { error: stopError } = await supabase
        .from("time_entry")
        .update({ stopped_at: startedAt })
        .is("stopped_at", null);
      if (stopError) throw stopError;

      const { error } = await supabase
        .from("time_entry")
        .insert({ task_id: taskId, started_at: startedAt });
      if (error) throw error;
    },
    (entries, taskId) =>
      applyTimerStart(entries, {
        // Replaced by the real row on the next fetch; it only has to be unique
        // enough to key a list for the moments in between.
        id: crypto.randomUUID(),
        task_id: taskId,
        started_at: new Date().toISOString(),
        stopped_at: null,
        source: "manual",
      }),
  );
}

export function useStopTimer() {
  // Explicit `void`: stopping needs no arguments — there is only ever one open
  // entry, and the update finds it by `stopped_at is null`.
  return useTimeEntryMutation<void>(
    async () => {
      const { error } = await supabase
        .from("time_entry")
        .update({ stopped_at: new Date().toISOString() })
        .is("stopped_at", null);
      if (error) throw error;
    },
    (entries) => applyTimerStop(entries, new Date().toISOString()),
  );
}

// Dropping a mistaken run. Filtered by id alone: the delete policy scopes the
// statement to the caller's own rows, so an id belonging to somebody else
// matches nothing rather than deleting their time.
export function useDeleteTimeEntry() {
  return useTimeEntryMutation(
    async (entryId: string) => {
      const { error } = await supabase.from("time_entry").delete().eq("id", entryId);
      if (error) throw error;
    },
    (entries, entryId) => removeEntry(entries, entryId),
  );
}
