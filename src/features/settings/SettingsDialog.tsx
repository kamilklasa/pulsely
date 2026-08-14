import { useTranslation } from "react-i18next";
import { TwoFactorSection } from "@/features/two-factor";
import { Dialog, DialogDescription, DialogPopup, DialogTitle } from "@/shared/ui";
import { ChangeEmailForm } from "./ChangeEmailForm";
import { GoogleIntegrationRow } from "./GoogleIntegrationRow";

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="px-6 py-5">
      <div className="min-w-0">
        <h3 className="text-sm font-medium">{title}</h3>
        {description ? (
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{description}</p>
        ) : null}
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

          <TwoFactorSection />

          <Section title={t("integrations.title")} description={t("integrations.description")}>
            <GoogleIntegrationRow />
          </Section>
        </div>
      </DialogPopup>
    </Dialog>
  );
}
