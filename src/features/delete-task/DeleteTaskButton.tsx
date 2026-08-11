import { Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/ui";
import { useDeleteTask } from "./delete-task.data";

export function DeleteTaskButton({ taskId }: { taskId: string }) {
  const { t } = useTranslation("delete-task");
  const deleteTask = useDeleteTask();

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={t("trigger")}
      disabled={deleteTask.isPending}
      onClick={() => deleteTask.mutate(taskId)}
    >
      <Trash2 />
    </Button>
  );
}
