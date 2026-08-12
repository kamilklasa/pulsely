import { AnimatePresence, motion } from "motion/react";
import { Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  entryDurationMs,
  taskEntriesNewestFirst,
  useDeleteTimeEntry,
  useTimeEntries,
} from "@/entities/time-entry";
import { formatClockTime, formatDuration, formatEntryStart } from "@/features/track-time";
import { Button } from "@/shared/ui";
import { cn } from "@/shared/lib/utils";

// The runs logged against one task, newest first. The open run is in here too,
// counting up — the dialog re-renders on the card's stopwatch tick, so its row
// moves with the total above it rather than freezing at the time it mounted.
export function TimeEntryList({ taskId }: { taskId: string }) {
  const { t, i18n } = useTranslation("task-details");
  const { data: entries } = useTimeEntries();
  const deleteEntry = useDeleteTimeEntry();

  const rows = taskEntriesNewestFirst(entries ?? [], taskId);
  const now = Date.now();

  if (rows.length === 0) {
    return (
      <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{t("timeline.empty")}</p>
    );
  }

  return (
    <ol className="mt-4 space-y-0.5">
      <AnimatePresence initial={false}>
        {rows.map((entry) => {
          const stoppedAt = entry.stopped_at;
          const running = stoppedAt === null;
          const duration = formatDuration(entryDurationMs(entry, now));

          return (
            <motion.li
              key={entry.id}
              layout="position"
              // The exit plays because the delete patches the cache before the
              // round-trip: the row is gone from the list the moment it is
              // pressed, so the fade is what it leaves behind.
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.16, ease: [0.4, 0, 0.2, 1] }}
              className="group/entry flex items-center gap-3 rounded-lg py-1.5 pr-1 pl-2 transition-colors hover:bg-muted/50"
            >
              <span
                aria-hidden
                className={cn(
                  "size-1.5 shrink-0 rounded-full",
                  running ? "bg-emerald-600 dark:bg-emerald-400" : "bg-muted-foreground/30",
                )}
              />
              <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                {formatEntryStart(entry.started_at, i18n.language)}
                {" – "}
                {stoppedAt === null
                  ? t("timeline.running")
                  : formatClockTime(stoppedAt, i18n.language)}
              </span>
              <span
                className={cn(
                  "shrink-0 text-xs tabular-nums",
                  running ? "text-emerald-700 dark:text-emerald-400" : "text-foreground",
                )}
              >
                {duration}
              </span>
              {/* Hidden until the row is hovered or focused, so a list of runs
                  reads as a list rather than a column of bins — but it stays in
                  the layout, so revealing it never shifts the row. */}
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label={t("timeline.delete", { duration })}
                // No pending state to disable against: the optimistic patch
                // takes the row out of the list in the same tick as the click,
                // and a shared `isPending` would grey out every other row's
                // button while one delete was in flight.
                onClick={() => deleteEntry.mutate(entry.id)}
                className="shrink-0 text-muted-foreground/60 opacity-0 transition-opacity group-hover/entry:opacity-100 hover:text-destructive focus-visible:opacity-100"
              >
                <Trash2 />
              </Button>
            </motion.li>
          );
        })}
      </AnimatePresence>
    </ol>
  );
}
