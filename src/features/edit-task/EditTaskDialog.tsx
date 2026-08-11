import { useMemo, useState } from "react";
import { Pencil } from "lucide-react";
import { useForm } from "@tanstack/react-form";
import { useTranslation } from "react-i18next";
import type { Task } from "@/entities/task";
import {
  Button,
  Dialog,
  DialogPopup,
  DialogTitle,
  DialogTrigger,
  Input,
  Textarea,
} from "@/shared/ui";
import { useUpdateTask } from "./edit-task.data";
import { createTitleSchema } from "./edit-task.schema";

function EditTaskFields({ task, onSaved }: { task: Task; onSaved: () => void }) {
  const { t } = useTranslation("edit-task");
  const updateTask = useUpdateTask();
  const titleSchema = useMemo(() => createTitleSchema(t), [t]);

  const form = useForm({
    defaultValues: { title: task.title, description: task.description ?? "" },
    onSubmit: async ({ value }) => {
      await updateTask.mutateAsync({ id: task.id, ...value });
      onSaved();
    },
  });

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void form.handleSubmit();
      }}
      className="flex flex-col gap-3"
      noValidate
    >
      <form.Field name="title" validators={{ onChange: titleSchema }}>
        {(field) => (
          <div>
            <Input
              name={field.name}
              placeholder={t("form.titlePlaceholder")}
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(event) => field.handleChange(event.target.value)}
              aria-invalid={Boolean(field.state.meta.errors.length)}
            />
            {field.state.meta.errors.length ? (
              <p className="mt-1 text-sm text-destructive">
                {field.state.meta.errors
                  .map((error) => (typeof error === "string" ? error : error?.message))
                  .join(", ")}
              </p>
            ) : null}
          </div>
        )}
      </form.Field>
      <form.Field name="description">
        {(field) => (
          <Textarea
            name={field.name}
            placeholder={t("form.descriptionPlaceholder")}
            value={field.state.value}
            onBlur={field.handleBlur}
            onChange={(event) => field.handleChange(event.target.value)}
          />
        )}
      </form.Field>
      {updateTask.isError ? (
        <p className="text-sm text-destructive">{t("form.mutationError")}</p>
      ) : null}
      <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting] as const}>
        {([canSubmit, isSubmitting]) => (
          <Button type="submit" disabled={!canSubmit || updateTask.isPending} className="self-end">
            {isSubmitting || updateTask.isPending ? t("form.saving") : t("form.save")}
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
}

export function EditTaskDialog({ task }: { task: Task }) {
  const { t } = useTranslation("edit-task");
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="ghost" size="icon-sm" aria-label={t("trigger")}>
            <Pencil />
          </Button>
        }
      />
      <DialogPopup>
        <DialogTitle className="mb-4">{t("heading")}</DialogTitle>
        {open ? <EditTaskFields key={task.id} task={task} onSaved={() => setOpen(false)} /> : null}
      </DialogPopup>
    </Dialog>
  );
}
