import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { TASK_STATUSES, useTasks, type Task, type TaskStatus } from "@/entities/task";
import { CreateTaskForm } from "@/features/create-task";
import { TaskCard } from "./TaskCard";

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
  const { t: tTask } = useTranslation("task");
  const { data: tasks, isPending, isError } = useTasks();
  const columns = useMemo(() => groupByStatus(tasks ?? []), [tasks]);

  return (
    <div className="flex w-full flex-col gap-6">
      <CreateTaskForm className="max-w-md" />

      {isError ? <p className="text-sm text-destructive">{t("loadError")}</p> : null}

      {isPending ? (
        <p className="text-sm text-muted-foreground">{t("loading")}</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {TASK_STATUSES.map((status) => (
            <section key={status} className="flex flex-col gap-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase">
                {tTask(`columns.${status}`)}
              </h2>
              <ul className="flex flex-col gap-2">
                {columns[status].map((task) => (
                  <TaskCard key={task.id} task={task} />
                ))}
              </ul>
              {columns[status].length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("empty")}</p>
              ) : null}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
