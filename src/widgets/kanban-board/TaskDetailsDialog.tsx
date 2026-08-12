import { useTranslation } from "react-i18next";
import type { Task } from "@/entities/task";
import { TrackTimeButton, type Stopwatch } from "@/features/track-time";
import { Badge, Dialog, DialogDescription, DialogPopup, DialogTitle } from "@/shared/ui";
import { TimeBreakdown } from "./TimeBreakdown";

// Three bars on a rail, no labels and no numbers: it reads as "a timeline goes
// here" without inventing entries that a user could mistake for their own.
function TimelinePlaceholder() {
  return (
    <ol aria-hidden className="mt-4 space-y-3.5 border-l border-border pl-5">
      {[72, 48, 60].map((width, index) => (
        <li key={index} className="relative">
          <span className="absolute top-0.5 -left-[23px] size-2.5 rounded-full border-2 border-background bg-muted-foreground/25" />
          <span
            className="block h-2.5 rounded-full bg-muted-foreground/15"
            style={{ width: `${width}%` }}
          />
          <span className="mt-1.5 block h-2 w-14 rounded-full bg-muted-foreground/10" />
        </li>
      ))}
    </ol>
  );
}

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
              <Badge>{t("soon")}</Badge>
            </div>
            <TimelinePlaceholder />
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              {t("timeline.description")}
            </p>
          </section>
        </div>
      </DialogPopup>
    </Dialog>
  );
}
