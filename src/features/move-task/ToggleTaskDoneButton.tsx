import { Circle, CircleCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { TaskStatus } from "@/entities/task";
import { cn } from "@/shared/lib/utils";
import { useMoveTask } from "./move-task.data";

// Un-checking has no "where did it come from" to restore — the schema doesn't
// record it — so it goes back to Today, the column you'd be working out of.
const UNDONE_STATUS: TaskStatus = "today";

export function ToggleTaskDoneButton({ taskId, status }: { taskId: string; status: TaskStatus }) {
  const { t } = useTranslation("move-task");
  const moveTask = useMoveTask();
  const done = status === "done";

  return (
    <button
      type="button"
      aria-label={done ? t("markUndone") : t("markDone")}
      aria-pressed={done}
      disabled={moveTask.isPending}
      onClick={() => moveTask.mutate({ id: taskId, status: done ? UNDONE_STATUS : "done" })}
      className={cn(
        "mt-px shrink-0 rounded-full text-muted-foreground/50 outline-none transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none",
        done && "text-emerald-500 hover:text-emerald-500/70",
      )}
    >
      {done ? <CircleCheck className="size-4" /> : <Circle className="size-4" />}
    </button>
  );
}
