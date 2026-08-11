import type { Task } from "@/entities/task";
import { DeleteTaskButton } from "@/features/delete-task";
import { EditTaskDialog } from "@/features/edit-task";
import { MoveTaskSelect } from "@/features/move-task";

export function TaskCard({ task }: { task: Task }) {
  return (
    <li className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3 text-card-foreground">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium break-words">{task.title}</p>
        <div className="flex shrink-0 items-center gap-0.5">
          <EditTaskDialog task={task} />
          <DeleteTaskButton taskId={task.id} />
        </div>
      </div>
      {task.description ? (
        <p className="text-sm whitespace-pre-wrap text-muted-foreground">{task.description}</p>
      ) : null}
      <MoveTaskSelect taskId={task.id} status={task.status} />
    </li>
  );
}
