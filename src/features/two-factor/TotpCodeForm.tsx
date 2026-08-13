import { useId, useMemo } from "react";
import { useForm } from "@tanstack/react-form";
import { useTranslation } from "react-i18next";
import { REGEXP_ONLY_DIGITS } from "input-otp";
import { Button, InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from "@/shared/ui";
import { createTotpCodeSchema, TOTP_CODE_LENGTH } from "./two-factor.schema";
import { twoFactorErrorKey } from "./two-factor.utils";

const SLOTS = Array.from({ length: TOTP_CODE_LENGTH }, (_, index) => index);
const GROUP_SIZE = TOTP_CODE_LENGTH / 2;

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
  // The slots can only ever hold digits, and only six of them, so the schema can
  // no longer be reached by typing — it stays as the guard on the value that is
  // actually submitted rather than as something the user is expected to trip.
  const schema = useMemo(() => createTotpCodeSchema(t), [t]);

  const form = useForm({
    defaultValues: { code: "" },
    onSubmit: async ({ value }) => {
      await onSubmit(value.code);
    },
  });

  const invalid = Boolean(error);

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
      <form.Field name="code" validators={{ onSubmit: schema }}>
        {(field) => (
          <div className="mt-2 flex flex-col gap-3">
            <InputOTP
              id={fieldId}
              maxLength={TOTP_CODE_LENGTH}
              pattern={REGEXP_ONLY_DIGITS}
              // `one-time-code` is what makes iOS and Android offer the code
              // from the notification shade instead of the password manager.
              autoComplete="one-time-code"
              autoFocus={autoFocus}
              disabled={isPending}
              containerClassName="justify-center"
              value={field.state.value}
              onChange={(code) => {
                // The rejection belongs to the code that was sent; editing it
                // makes the message stale, so it goes at the first keystroke.
                if (invalid) onReset?.();
                field.handleChange(code);
              }}
              // Six digits is the whole input — asking for a button press after
              // the last one is a step the user has no reason to take. The catch
              // is not swallowing the failure: it is already on screen, read off
              // the mutation's own error state below.
              onComplete={(code: string) => {
                if (!isPending) void onSubmit(code).catch(() => {});
              }}
            >
              <InputOTPGroup>
                {SLOTS.slice(0, GROUP_SIZE).map((index) => (
                  <InputOTPSlot
                    key={index}
                    index={index}
                    aria-invalid={invalid}
                    className="size-11 text-base"
                  />
                ))}
              </InputOTPGroup>
              <InputOTPSeparator />
              <InputOTPGroup>
                {SLOTS.slice(GROUP_SIZE).map((index) => (
                  <InputOTPSlot
                    key={index}
                    index={index}
                    aria-invalid={invalid}
                    className="size-11 text-base"
                  />
                ))}
              </InputOTPGroup>
            </InputOTP>

            <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting] as const}>
              {([canSubmit, isSubmitting]) => (
                <Button
                  type="submit"
                  size="lg"
                  variant={variant}
                  className="w-full"
                  disabled={!canSubmit || isPending || field.state.value.length < TOTP_CODE_LENGTH}
                >
                  {isSubmitting || isPending ? pendingLabel : submitLabel}
                </Button>
              )}
            </form.Subscribe>

            {field.state.meta.errors.length ? (
              <p className="text-xs text-destructive">
                {field.state.meta.errors
                  .map((issue) => (typeof issue === "string" ? issue : issue?.message))
                  .join(", ")}
              </p>
            ) : null}
          </div>
        )}
      </form.Field>
      {error ? (
        <p className="mt-2 text-xs text-destructive">{t(`error.${twoFactorErrorKey(error)}`)}</p>
      ) : null}
    </form>
  );
}
