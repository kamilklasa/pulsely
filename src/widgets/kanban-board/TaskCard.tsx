import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Task } from "@/entities/task";
import { MoveTaskArrows, ToggleTaskDoneButton } from "@/features/move-task";
import { TrackTimeButton, useStopwatch } from "@/features/track-time";
import { cn } from "@/shared/lib/utils";
import { TaskCardMenu } from "./TaskCardMenu";
import { TaskDetailsDialog } from "./TaskDetailsDialog";

export function TaskCard({ task, overlay = false }: { task: Task; overlay?: boolean }) {
  const { t } = useTranslation("task");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const stopwatch = useStopwatch(task.id);
  // Pointer/touch only: no keyboard sensor is wired up, so the handle is
  // pulled out of tab order (tabIndex: -1) instead of being a dead focus
  // stop. The move arrows stay the keyboard-accessible way to change column.
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    data: { status: task.status },
    attributes: { tabIndex: -1 },
  });

  // The card doubles as a big click target, but it is full of real controls —
  // anything that resolves to one of those is their click, not the card's.
  function handleCardClick(event: React.MouseEvent<HTMLElement>) {
    if (overlay) return;

    // The overflow menu and both dialogs render into portals. React bubbles
    // their events up the component tree regardless of where they sit in the
    // DOM, so "Edit task" arrived here and opened the details dialog on top of
    // the edit one. A DOM containment check is what tells the two apart.
    const target = event.target as HTMLElement;
    if (!event.currentTarget.contains(target)) return;
    if (target.closest("button, a, input")) return;

    setDetailsOpen(true);
  }

  return (
    <li
      onClick={handleCardClick}
      ref={overlay ? undefined : setNodeRef}
      // The cards a drag pushes out of the way slide with a transform; the
      // overlay copy is positioned by DragOverlay itself and must not inherit
      // the source card's own transform.
      style={overlay ? undefined : { transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        // DragOverlay's wrapper already sizes itself to match the source card's measured
        // rect (inline width/height), so this fills that width naturally — forcing a
        // fixed width here would fight it and read as a resize glitch on pickup/drop.
        "group/card relative flex flex-col gap-1 rounded-xl border border-border/60 bg-card px-3 py-2.5 text-card-foreground shadow-2xs transition-[border-color,box-shadow,opacity]",
        !overlay && "cursor-pointer hover:border-border hover:shadow-xs",
        isDragging && "opacity-40",
        // The dragged copy is the one thing that should actually look lifted.
        overlay && "shadow-md",
      )}
    >
      <div className="flex items-start gap-2">
        <ToggleTaskDoneButton taskId={task.id} status={task.status} />
        {/* A button, not a heading: it is the keyboard route into the details,
            which a click-anywhere card surface can't provide on its own. */}
        <button
          type="button"
          disabled={overlay}
          onClick={() => setDetailsOpen(true)}
          className={cn(
            "min-w-0 flex-1 rounded pr-6 text-left text-sm leading-snug font-medium break-words outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none",
            task.status === "done" && "text-muted-foreground line-through decoration-from-font",
          )}
        >
          {task.title}
        </button>
      </div>
      {task.description ? (
        <p className="text-sm leading-snug whitespace-pre-wrap text-muted-foreground">
          {task.description}
        </p>
      ) : null}
      {/* Floated over the title's trailing space rather than taking a row of its own:
          keeps every card at its content height whether or not it's hovered. */}
      {/* ::before fades the card background into the cluster so a long title
          slides under it instead of being chopped mid-word. */}
      {/* pointer-events have to follow the opacity: at rest the cluster is
          invisible but still sits over the title's trailing edge, and would
          otherwise swallow the clicks meant to open the task details. */}
      <div className="pointer-events-none absolute top-1.5 right-1.5 flex items-center gap-0.5 rounded-lg bg-card opacity-0 transition-opacity group-hover/card:pointer-events-auto group-hover/card:opacity-100 focus-within:pointer-events-auto focus-within:opacity-100 before:pointer-events-none before:absolute before:top-0 before:right-full before:h-full before:w-8 before:bg-linear-to-r before:from-transparent before:to-card before:content-['']">
        <MoveTaskArrows taskId={task.id} status={task.status} />
        <TaskCardMenu task={task} />
        <button
          ref={setActivatorNodeRef}
          type="button"
          aria-label={t("dragHandle")}
          className="cursor-grab touch-none rounded p-0.5 text-muted-foreground/50 outline-none hover:text-muted-foreground focus-visible:ring-3 focus-visible:ring-ring/50 active:cursor-grabbing"
          {...listeners}
          {...attributes}
        >
          <GripVertical className="size-3.5" />
        </button>
      </div>

      {/* -ml-1 pulls the ghost button's own padding back so its label lines up
          with the done toggle above it rather than floating a notch inward. */}
      <div className="-ml-1 flex items-center justify-between gap-2 pt-1">
        <TrackTimeButton stopwatch={stopwatch} />
      </div>

      {overlay ? null : (
        <TaskDetailsDialog
          task={task}
          stopwatch={stopwatch}
          open={detailsOpen}
          onOpenChange={setDetailsOpen}
        />
      )}
    </li>
  );
}
