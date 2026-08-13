import { useId, useMemo } from "react";
import { useForm } from "@tanstack/react-form";
import { useTranslation } from "react-i18next";
import { Button, Input } from "@/shared/ui";
import { createTotpCodeSchema, TOTP_CODE_LENGTH } from "./two-factor.schema";
import { normalizeTotpCode, twoFactorErrorKey } from "./two-factor.utils";

// Setup, removal and the sign-in challenge all ask the same question — six digits
// from the app — so they share the field, the validation and the error line, and
// differ only in what the button says and what submitting does.
export function TotpCodeForm({
  submitLabel,
  pendingLabel,
  isPending,
  error,
  onSubmit,
  onReset,
  variant = "default",
  autoFocus = false,
  className,
}: {
  submitLabel: string;
  pendingLabel: string;
  isPending: boolean;
  error: unknown;
  onSubmit: (code: string) => Promise<void>;
  onReset?: () => void;
  variant?: "default" | "destructive";
  autoFocus?: boolean;
  className?: string;
}) {
  const { t } = useTranslation("two-factor");
  const fieldId = useId();
  const schema = useMemo(() => createTotpCodeSchema(t), [t]);

  const form = useForm({
    defaultValues: { code: "" },
    onSubmit: async ({ value }) => {
      // TanStack Form validates against the schema but submits the raw field
      // value, so the same normalisation has to run on the way out.
      await onSubmit(normalizeTotpCode(value.code));
    },
  });

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void form.handleSubmit();
      }}
      className={className}
      noValidate
    >
      <label htmlFor={fieldId} className="text-xs font-medium text-muted-foreground">
        {t("code.label")}
      </label>
      <form.Field name="code" validators={{ onChange: schema }}>
        {(field) => (
          <>
            <div className="mt-2 flex items-center gap-2">
              <Input
                id={fieldId}
                // `one-time-code` is what makes iOS and Android offer the code
                // from the notification shade instead of the password manager.
                autoComplete="one-time-code"
                inputMode="numeric"
                pattern="[0-9]*"
                // +1 so "123 456" — what the app actually shows — still fits.
                maxLength={TOTP_CODE_LENGTH + 1}
                autoFocus={autoFocus}
                placeholder="000000"
                name={field.name}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(event) => {
                  // The rejection belongs to the code that was sent; editing it
                  // makes the message stale, so it goes at the first keystroke.
                  if (error) onReset?.();
                  field.handleChange(event.target.value);
                }}
                disabled={isPending}
                aria-invalid={Boolean(field.state.meta.errors.length || error)}
                className="font-mono tracking-[0.3em]"
              />
              <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting] as const}>
                {([canSubmit, isSubmitting]) => (
                  <Button
                    type="submit"
                    size="lg"
                    variant={variant}
                    disabled={!canSubmit || isPending}
                  >
                    {isSubmitting || isPending ? pendingLabel : submitLabel}
                  </Button>
                )}
              </form.Subscribe>
            </div>
            {field.state.meta.errors.length ? (
              <p className="mt-2 text-xs text-destructive">
                {field.state.meta.errors
                  .map((issue) => (typeof issue === "string" ? issue : issue?.message))
                  .join(", ")}
              </p>
            ) : null}
          </>
        )}
      </form.Field>
      {error ? (
        <p className="mt-2 text-xs text-destructive">{t(`error.${twoFactorErrorKey(error)}`)}</p>
      ) : null}
    </form>
  );
}
