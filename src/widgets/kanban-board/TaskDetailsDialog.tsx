import { useTranslation } from "react-i18next";
import type { Task } from "@/entities/task";
import { formatDuration, TrackTimeButton, type Stopwatch } from "@/features/track-time";
import { Badge, Dialog, DialogDescription, DialogPopup, DialogTitle } from "@/shared/ui";
import { TimeBreakdown } from "./TimeBreakdown";
import { TimeEntryList } from "./TimeEntryList";

export function TaskDetailsDialog({
  task,
  stopwatch,
  open,
  onOpenChange,
}: {
  task: Task;
  stopwatch: Stopwatch;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation("task-details");
  const { t: tTask } = useTranslation("task");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="max-w-lg p-0">
        <header className="px-6 pt-6 pb-5">
          <Badge className="mb-3">{tTask(`columns.${task.status}`)}</Badge>
          <DialogTitle className="pr-6 text-base leading-snug">{task.title}</DialogTitle>
          {task.description ? (
            <DialogDescription className="mt-1.5 whitespace-pre-wrap">
              {task.description}
            </DialogDescription>
          ) : null}
          <div className="mt-4">
            <TrackTimeButton stopwatch={stopwatch} size="sm" />
          </div>
        </header>

        <div className="max-h-[55vh] divide-y divide-border/60 overflow-y-auto border-t border-border/60">
          <section className="px-6 py-5">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-medium">{t("breakdown.title")}</h3>
              <Badge>{t("soon")}</Badge>
            </div>
            <TimeBreakdown />
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              {t("breakdown.description")}
            </p>
          </section>

          <section className="px-6 py-5">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-medium">{t("timeline.title")}</h3>
              {/* The same Seam A total the card's stopwatch shows, restated
                  over the list it is the sum of — so deleting a run visibly
                  takes its time off the task. */}
              <span className="text-xs tabular-nums text-muted-foreground">
                {t("timeline.total", { duration: formatDuration(stopwatch.elapsedMs) })}
              </span>
            </div>
            <TimeEntryList taskId={task.id} />
          </section>
        </div>
      </DialogPopup>
    </Dialog>
  );
}
