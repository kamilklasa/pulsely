import { useMemo } from "react";
import { useForm } from "@tanstack/react-form";
import { useTranslation } from "react-i18next";
import { Button, Input } from "@/shared/ui";
import { cn } from "@/shared/lib/utils";
import { useCreateTask } from "./create-task.data";
import { createTitleSchema } from "./create-task.schema";

export function CreateTaskForm({ className }: { className?: string }) {
  const { t } = useTranslation("create-task");
  const createTask = useCreateTask();
  const titleSchema = useMemo(() => createTitleSchema(t), [t]);

  const form = useForm({
    defaultValues: { title: "" },
    onSubmit: async ({ value, formApi }) => {
      await createTask.mutateAsync(value.title);
      formApi.reset();
    },
  });

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void form.handleSubmit();
      }}
      className={cn("flex items-start gap-2", className)}
      noValidate
    >
      <form.Field name="title" validators={{ onChange: titleSchema }}>
        {(field) => (
          <div className="flex-1">
            <Input
              name={field.name}
              placeholder={t("form.titlePlaceholder")}
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(event) => field.handleChange(event.target.value)}
              aria-invalid={Boolean(field.state.meta.errors.length || createTask.isError)}
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
      <div className="flex flex-col gap-1">
        <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting] as const}>
          {([canSubmit, isSubmitting]) => (
            <Button type="submit" disabled={!canSubmit || createTask.isPending}>
              {isSubmitting || createTask.isPending ? t("form.submitting") : t("form.submit")}
            </Button>
          )}
        </form.Subscribe>
        {createTask.isError ? (
          <p className="text-sm text-destructive">{t("form.mutationError")}</p>
        ) : null}
      </div>
    </form>
  );
}
