import { useMemo, useRef } from "react";
import { X } from "lucide-react";
import { useForm } from "@tanstack/react-form";
import { useTranslation } from "react-i18next";
import type { TaskStatus } from "@/entities/task";
import { Button, Input } from "@/shared/ui";
import { cn } from "@/shared/lib/utils";
import { useCreateTask } from "./create-task.data";
import { createTitleSchema } from "./create-task.schema";

interface CreateTaskFormProps {
  status: TaskStatus;
  onCancel: () => void;
  className?: string;
}

// Stays open after a successful add (form resets, focus returns to the
// input) so adding several tasks in a row doesn't require re-opening it —
// only Escape/blur/the cancel button close it, via `onCancel`.
export function CreateTaskForm({ status, onCancel, className }: CreateTaskFormProps) {
  const { t } = useTranslation("create-task");
  const createTask = useCreateTask();
  const titleSchema = useMemo(() => createTitleSchema(t), [t]);
  const inputRef = useRef<HTMLInputElement>(null);

  const form = useForm({
    defaultValues: { title: "" },
    onSubmit: async ({ value, formApi }) => {
      await createTask.mutateAsync({ title: value.title, status });
      formApi.reset();
      inputRef.current?.focus();
    },
  });

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void form.handleSubmit();
      }}
      className={cn("flex flex-col gap-1.5", className)}
      noValidate
    >
      <div className="flex items-start gap-1.5">
        <form.Field name="title" validators={{ onChange: titleSchema }}>
          {(field) => (
            <div className="flex-1">
              <Input
                ref={inputRef}
                autoFocus
                name={field.name}
                placeholder={t("form.titlePlaceholder")}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") onCancel();
                }}
                aria-invalid={Boolean(field.state.meta.errors.length || createTask.isError)}
                className="h-9"
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
        <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting] as const}>
          {([canSubmit, isSubmitting]) => (
            <Button type="submit" size="sm" disabled={!canSubmit || createTask.isPending}>
              {isSubmitting || createTask.isPending ? t("form.submitting") : t("form.submit")}
            </Button>
          )}
        </form.Subscribe>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={t("form.cancel")}
          onClick={onCancel}
        >
          <X />
        </Button>
      </div>
      {createTask.isError ? (
        <p className="text-sm text-destructive">{t("form.mutationError")}</p>
      ) : null}
    </form>
  );
}
