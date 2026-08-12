import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  pointerWithin,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useTranslation } from "react-i18next";
import { arrayMove } from "@dnd-kit/sortable";
import {
  TASK_STATUSES,
  canTransition,
  countDoneSince,
  sortOrderBetween,
  startOfToday,
  startOfWeek,
  useTasks,
  type Task,
  type TaskStatus,
} from "@/entities/task";
import { useMoveTask } from "@/features/move-task";
import { KanbanColumn, type ColumnProgress } from "./KanbanColumn";
import { TaskCard } from "./TaskCard";

// Rect-based detection (the default) compares the dragged card's own centre to
// each droppable's, which lets the tall column droppable beat the small card
// the pointer is actually over — and every cross-column drop then lands at the
// bottom. The cursor is the intent here; the rect fallback only covers a drag
// released outside every column.
const collisionDetection: CollisionDetection = (args) => {
  const underPointer = pointerWithin(args);
  return underPointer.length > 0 ? underPointer : closestCorners(args);
};

function groupByStatus(tasks: Task[]): Record<TaskStatus, Task[]> {
  const groups: Record<TaskStatus, Task[]> = {
    backlog: [],
    this_week: [],
    today: [],
    done: [],
  };
  for (const task of tasks) groups[task.status].push(task);
  return groups;
}

export function KanbanBoard() {
  const { t } = useTranslation("board");
  const { data: tasks, isPending, isError } = useTasks();
  const moveTask = useMoveTask();
  const columns = useMemo(() => groupByStatus(tasks ?? []), [tasks]);
  // Only the two time-boxed columns get a bar: "how much of what I planned for
  // today / this week is finished". Backlog and Done have no such horizon.
  const progress = useMemo<Partial<Record<TaskStatus, ColumnProgress>>>(() => {
    const doneToday = countDoneSince(columns.done, startOfToday());
    const doneThisWeek = countDoneSince(columns.done, startOfWeek());
    return {
      today: { done: doneToday, total: doneToday + columns.today.length },
      this_week: { done: doneThisWeek, total: doneThisWeek + columns.this_week.length },
    };
  }, [columns]);
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  // A small activation distance avoids hijacking simple taps on the drag
  // handle before an intentional drag is confirmed.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  function handleDragStart(event: DragStartEvent) {
    setActiveTask(tasks?.find((task) => task.id === event.active.id) ?? null);
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveTask(null);
    if (!over || over.id === active.id) return;

    const dragged = tasks?.find((task) => task.id === active.id);
    if (!dragged) return;

    // `over` is either another card or — when the drop lands on a column's
    // empty space — the column droppable, whose id is the status itself.
    const overTask = tasks?.find((task) => task.id === over.id);
    const targetStatus = overTask ? overTask.status : (over.id as TaskStatus);
    const column = columns[targetStatus] as Task[] | undefined;
    if (!column) return;
    // The blocked column is already dimmed and refuses to be hovered, but its
    // cards are sortable droppables of their own — so a drop landing on one of
    // them still has to be turned away here.
    if (!canTransition(dragged.status, targetStatus)) return;

    // Where the card ends up: on top of another card it takes that card's slot
    // (pushing it down/up), on empty space it goes to the bottom.
    const insertAt =
      overTask && targetStatus === dragged.status
        ? arrayMove(column, column.indexOf(dragged), column.indexOf(overTask)).indexOf(dragged)
        : overTask
          ? column.indexOf(overTask)
          : column.length;

    const neighbours = column.filter((task) => task.id !== dragged.id);
    const sortOrder = sortOrderBetween(neighbours[insertAt - 1], neighbours[insertAt]);
    if (targetStatus === dragged.status && sortOrder === dragged.sort_order) return;

    moveTask.mutate({ id: dragged.id, status: targetStatus, sortOrder });
  }

  if (isError) return <p className="text-sm text-destructive">{t("loadError")}</p>;
  if (isPending) return <p className="text-sm text-muted-foreground">{t("loading")}</p>;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveTask(null)}
    >
      {/* Columns grow to fill the board, but `min-w` is the floor they refuse to
          shrink past — so a narrow viewport overflows into a swipeable scroller
          instead of squeezing four unreadable columns into the width, which is
          what a plain grid does. */}
      <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6">
        {TASK_STATUSES.map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            tasks={columns[status]}
            progress={progress[status]}
            // Says "not there" while the card is still in the air, instead of
            // letting the drop look accepted and then snap back.
            blocked={activeTask ? !canTransition(activeTask.status, status) : false}
            className="min-w-[17rem] flex-1 snap-start"
          />
        ))}
      </div>
      {/* useMoveTask patches the query cache optimistically (see move-task.data.ts), so
          the card is already sitting in its new column by drop time — the default drop
          animation can fly the overlay to that real position instead of snapping back
          to the stale pre-move one. */}
      <DragOverlay>{activeTask ? <TaskCard task={activeTask} overlay /> : null}</DragOverlay>
    </DndContext>
  );
}
