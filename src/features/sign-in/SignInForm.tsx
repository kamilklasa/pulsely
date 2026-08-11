import { useForm } from "@tanstack/react-form";
import { Button } from "@/shared/ui";
import { Input } from "@/shared/ui";
import { cn } from "@/shared/lib/utils";
import { useSignInWithMagicLink } from "./sign-in.data";
import { emailSchema } from "./sign-in.schema";

export function SignInForm({ className }: { className?: string }) {
  const magicLink = useSignInWithMagicLink();

  const form = useForm({
    defaultValues: { email: "" },
    onSubmit: async ({ value }) => {
      await magicLink.mutateAsync(value.email);
    },
  });

  if (magicLink.isSuccess) {
    return (
      <p className={cn("text-sm text-muted-foreground", className)}>
        Check {form.getFieldValue("email")} for a sign-in link.
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
              placeholder="you@example.com"
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
        <p className="text-sm text-destructive">Couldn't send the link. Try again.</p>
      ) : null}
      <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting] as const}>
        {([canSubmit, isSubmitting]) => (
          <Button type="submit" size="lg" disabled={!canSubmit || magicLink.isPending}>
            {isSubmitting || magicLink.isPending ? "Sending…" : "Send magic link"}
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
}
