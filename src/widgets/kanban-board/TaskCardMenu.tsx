import { useState } from "react";
import { MoreVertical, Pencil, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Task } from "@/entities/task";
import { useDeleteTask } from "@/features/delete-task";
import { EditTaskDialog } from "@/features/edit-task";
import {
  Button,
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuPopup,
  DropdownMenuTrigger,
} from "@/shared/ui";

// The rarely-used half of the card's actions: everything that isn't "move it
// one column over" lives behind the overflow trigger.
export function TaskCardMenu({ task }: { task: Task }) {
  const { t } = useTranslation("task");
  const { t: tEdit } = useTranslation("edit-task");
  const { t: tDelete } = useTranslation("delete-task");
  const deleteTask = useDeleteTask();
  const [editing, setEditing] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="icon-sm" aria-label={t("moreActions")}>
              <MoreVertical />
            </Button>
          }
        />
        <DropdownMenuPopup className="min-w-[10rem]">
          <DropdownMenuItem onClick={() => setEditing(true)}>
            <Pencil />
            {tEdit("trigger")}
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={deleteTask.isPending}
            onClick={() => deleteTask.mutate(task.id)}
            className="text-destructive"
          >
            <Trash2 />
            {tDelete("trigger")}
          </DropdownMenuItem>
        </DropdownMenuPopup>
      </DropdownMenu>
      <EditTaskDialog task={task} open={editing} onOpenChange={setEditing} />
    </>
  );
}
