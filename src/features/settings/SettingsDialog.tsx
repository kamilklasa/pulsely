import { useTranslation } from "react-i18next";
import { useSession } from "@/entities/session";
import {
  Badge,
  Button,
  Dialog,
  DialogDescription,
  DialogPopup,
  DialogTitle,
  GoogleIcon,
  Switch,
} from "@/shared/ui";
import { ChangeEmailForm } from "./ChangeEmailForm";

// Two-factor and integrations are still stubs — the badge is the honest way to
// say so, instead of shipping controls that silently do nothing.
function SoonBadge() {
  const { t } = useTranslation("settings");
  return <Badge>{t("soon")}</Badge>;
}

function Section({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <section className="px-6 py-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-sm font-medium">{title}</h3>
          {description ? (
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function SettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation("settings");
  const { session } = useSession();
  const currentEmail = session?.user.email ?? "";

  // Supabase records every identity the account can sign in with; Google is
  // "connected" exactly when it's among them. Real status, stub controls.
  const providers = session?.user.app_metadata.providers;
  const googleConnected = Array.isArray(providers) && providers.includes("google");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="max-w-lg p-0">
        <header className="px-6 pt-6 pb-5">
          <DialogTitle>{t("heading")}</DialogTitle>
          <DialogDescription className="mt-1">{t("subheading")}</DialogDescription>
        </header>

        {/* divide-y instead of nested cards: three settings rows don't need
            three elevations to read as three groups. */}
        <div className="max-h-[60vh] divide-y divide-border/60 overflow-y-auto border-t border-border/60">
          <Section title={t("account.title")}>
            <ChangeEmailForm />
          </Section>

          <Section
            title={t("twoFactor.title")}
            description={t("twoFactor.description")}
            action={
              <div className="flex items-center gap-2.5">
                <SoonBadge />
                <Switch disabled aria-label={t("twoFactor.title")} />
              </div>
            }
          />

          <Section
            title={t("integrations.title")}
            description={t("integrations.description")}
            action={<SoonBadge />}
          >
            <div className="mt-3 flex items-center gap-3 rounded-xl border border-border/60 px-3 py-2.5">
              <GoogleIcon className="size-4 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{t("integrations.google")}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {googleConnected
                    ? t("integrations.connectedAs", { email: currentEmail })
                    : t("integrations.notConnected")}
                </p>
              </div>
              <Button type="button" variant="outline" size="sm" disabled>
                {googleConnected ? t("integrations.disconnect") : t("integrations.connect")}
              </Button>
            </div>
          </Section>
        </div>
      </DialogPopup>
    </Dialog>
  );
}
