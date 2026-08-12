import { useMemo, useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Circle, CircleCheck, CircleDashed, CircleDot, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Task, TaskStatus } from "@/entities/task";
import { CreateTaskForm } from "@/features/create-task";
import { Button, Progress, ProgressIndicator, ProgressTrack, ProgressValue } from "@/shared/ui";
import { cn } from "@/shared/lib/utils";
import { TaskCard } from "./TaskCard";

// Not a literal progress percentage — just a visual not-started → done
// progression so the column header reads at a glance, same idea as
// Linear/Height's status rings. The bar picks up the same hue so the header
// and its progress track read as one unit.
const STATUS_ICON: Record<
  TaskStatus,
  { icon: typeof Circle; className: string; indicatorClassName: string }
> = {
  backlog: {
    icon: Circle,
    className: "text-muted-foreground/50",
    indicatorClassName: "bg-muted-foreground/40",
  },
  this_week: { icon: CircleDashed, className: "text-sky-500", indicatorClassName: "bg-sky-500/70" },
  today: { icon: CircleDot, className: "text-amber-500", indicatorClassName: "bg-amber-500/70" },
  done: {
    icon: CircleCheck,
    className: "text-emerald-500",
    indicatorClassName: "bg-emerald-500/70",
  },
};

export interface ColumnProgress {
  done: number;
  total: number;
}

export function KanbanColumn({
  status,
  tasks,
  progress,
  blocked = false,
  className,
}: {
  status: TaskStatus;
  tasks: Task[];
  progress?: ColumnProgress;
  // The card currently being dragged isn't allowed to land here (see
  // `canTransition`) — the column stops reacting to the drag.
  blocked?: boolean;
  className?: string;
}) {
  const { t: tTask } = useTranslation("task");
  const { t: tCreate } = useTranslation("create-task");
  const { setNodeRef, isOver } = useDroppable({ id: status, disabled: blocked });
  const [adding, setAdding] = useState(false);
  const taskIds = useMemo(() => tasks.map((task) => task.id), [tasks]);
  const {
    icon: StatusIcon,
    className: statusIconClassName,
    indicatorClassName: statusIndicatorClassName,
  } = STATUS_ICON[status];

  return (
    // "Today" is the column you're meant to be working out of, so it gets the
    // one moving accent on the board — everything else stays flat.
    <section
      className={cn(
        // An outline, not a border: it takes no space in the box, so the edge
        // lands on the same pixel line as "today"'s animated ring — which is
        // painted by a pseudo-element inset to the padding box.
        "flex flex-col gap-3 rounded-xl bg-muted/40 p-3 outline-1 -outline-offset-1 outline-border/70 transition-opacity",
        status === "today" && "animated-border outline-none",
        blocked && "opacity-40",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <StatusIcon className={cn("size-4", statusIconClassName)} />
          <h2 className="text-sm font-medium">{tTask(`columns.${status}`)}</h2>
          <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-background px-1.5 py-0.5 text-xs text-muted-foreground">
            {tasks.length}
          </span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={tCreate("trigger")}
          onClick={() => setAdding(true)}
        >
          <Plus />
        </Button>
      </div>

      {/* max={0} would read as indeterminate, so a column with nothing planned
          shows an empty track instead. */}
      {progress ? (
        <Progress
          value={progress.done}
          max={Math.max(progress.total, 1)}
          aria-label={tTask("progressLabel", { column: tTask(`columns.${status}`) })}
        >
          <ProgressTrack>
            <ProgressIndicator className={statusIndicatorClassName} />
          </ProgressTrack>
          {/* Base UI passes the formatted percentage to `children`; the raw counts
              read better on a board, so that value is deliberately unused. */}
          <ProgressValue>
            {() => tTask("progressValue", { done: progress.done, total: progress.total })}
          </ProgressValue>
        </Progress>
      ) : (
        // Matches the bar row's height so the first card sits level across all
        // four columns.
        <div aria-hidden className="h-4" />
      )}

      {adding ? <CreateTaskForm status={status} onCancel={() => setAdding(false)} /> : null}

      <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
        <ul
          ref={setNodeRef}
          className={cn(
            "flex min-h-10 flex-1 flex-col gap-2 rounded-lg transition-colors",
            // Just enough to say "this column will take it" — the cards in a
            // sortable list already show where the drop would land.
            isOver && "outline-1 -outline-offset-1 outline-dotted outline-muted-foreground/40",
          )}
        >
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
          {tasks.length === 0 ? (
            <p
              className={cn(
                "rounded-lg p-1 text-sm text-muted-foreground/70",
                isOver && "flex flex-1 items-center justify-center py-5 text-xs",
              )}
            >
              {isOver ? tTask("dropHint") : tTask("empty")}
            </p>
          ) : null}
        </ul>
      </SortableContext>
    </section>
  );
}
