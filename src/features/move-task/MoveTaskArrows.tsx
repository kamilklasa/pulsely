import { ArrowLeft, ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { TASK_STATUSES, type TaskStatus } from "@/entities/task";
import { Button } from "@/shared/ui";
import { useMoveTask } from "./move-task.data";

// The columns are a fixed left-to-right pipeline, so "one column over" is the
// whole interaction — no picker needed for the common move.
export function MoveTaskArrows({ taskId, status }: { taskId: string; status: TaskStatus }) {
  const { t } = useTranslation("move-task");
  const moveTask = useMoveTask();
  const index = TASK_STATUSES.indexOf(status);
  const previous: TaskStatus | undefined = TASK_STATUSES[index - 1];
  const next: TaskStatus | undefined = TASK_STATUSES[index + 1];

  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={t("toPrevious")}
        disabled={!previous || moveTask.isPending}
        onClick={() => previous && moveTask.mutate({ id: taskId, status: previous })}
      >
        <ArrowLeft />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={t("toNext")}
        disabled={!next || moveTask.isPending}
        onClick={() => next && moveTask.mutate({ id: taskId, status: next })}
      >
        <ArrowRight />
      </Button>
    </>
  );
}
