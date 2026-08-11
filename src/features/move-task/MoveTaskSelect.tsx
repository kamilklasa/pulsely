import { useTranslation } from "react-i18next";
import { TASK_STATUSES, type TaskStatus } from "@/entities/task";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "@/shared/ui";
import { useMoveTask } from "./move-task.data";

export function MoveTaskSelect({ taskId, status }: { taskId: string; status: TaskStatus }) {
  const { t: tMove } = useTranslation("move-task");
  const { t: tTask } = useTranslation("task");
  const moveTask = useMoveTask();

  return (
    <Select
      value={status}
      onValueChange={(value) => {
        if (value !== status) moveTask.mutate({ id: taskId, status: value as TaskStatus });
      }}
      items={TASK_STATUSES.map((option) => ({ value: option, label: tTask(`columns.${option}`) }))}
    >
      <SelectTrigger aria-label={tMove("trigger")} disabled={moveTask.isPending}>
        <SelectValue>{(value: TaskStatus) => tTask(`columns.${value}`)}</SelectValue>
      </SelectTrigger>
      <SelectPopup>
        {TASK_STATUSES.map((option) => (
          <SelectItem key={option} value={option}>
            {tTask(`columns.${option}`)}
          </SelectItem>
        ))}
      </SelectPopup>
    </Select>
  );
}
