import { useMemo } from "react";
import { useForm } from "@tanstack/react-form";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/ui";
import { Input } from "@/shared/ui";
import { cn } from "@/shared/lib/utils";
import { useSignInWithMagicLink } from "./sign-in.data";
import { createEmailSchema } from "./sign-in.schema";

export function SignInForm({ className }: { className?: string }) {
  const { t } = useTranslation("sign-in");
  const magicLink = useSignInWithMagicLink();
  const emailSchema = useMemo(() => createEmailSchema(t), [t]);

  const form = useForm({
    defaultValues: { email: "" },
    onSubmit: async ({ value }) => {
      await magicLink.mutateAsync(value.email);
    },
  });

  if (magicLink.isSuccess) {
    return (
      <p className={cn("text-sm text-muted-foreground", className)}>
        {t("form.checkEmail", { email: form.getFieldValue("email") })}
      </p>
    );
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void form.handleSubmit();
      }}
      className={cn("flex flex-col gap-2", className)}
      noValidate
    >
      <form.Field name="email" validators={{ onChange: emailSchema }}>
        {(field) => (
          <>
            <Input
              type="email"
              name={field.name}
              placeholder={t("form.emailPlaceholder")}
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(event) => field.handleChange(event.target.value)}
              aria-invalid={Boolean(field.state.meta.errors.length || magicLink.isError)}
            />
            {field.state.meta.errors.length ? (
              <p className="text-sm text-destructive">
                {field.state.meta.errors
                  .map((error) => (typeof error === "string" ? error : error?.message))
                  .join(", ")}
              </p>
            ) : null}
          </>
        )}
      </form.Field>
      {magicLink.isError ? (
        <p className="text-sm text-destructive">{t("form.mutationError")}</p>
      ) : null}
      <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting] as const}>
        {([canSubmit, isSubmitting]) => (
          <Button type="submit" size="lg" disabled={!canSubmit || magicLink.isPending}>
            {isSubmitting || magicLink.isPending ? t("form.submitting") : t("form.submit")}
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
}
