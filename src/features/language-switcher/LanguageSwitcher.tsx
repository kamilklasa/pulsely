import { useTranslation } from "react-i18next";
import { Button } from "@/shared/ui";
import { cn } from "@/shared/lib/utils";
import { SUPPORTED_LOCALES, setLocale, useLocale } from "@/shared/i18n";

export function LanguageSwitcher({ className }: { className?: string }) {
  const { t } = useTranslation("common");
  const locale = useLocale();

  return (
    <div
      className={cn("inline-flex items-center gap-1", className)}
      role="group"
      aria-label={t("language.label")}
    >
      {SUPPORTED_LOCALES.map((option) => (
        <Button
          key={option}
          type="button"
          size="sm"
          variant={option === locale ? "secondary" : "ghost"}
          aria-pressed={option === locale}
          onClick={() => setLocale(option)}
        >
          {t(`language.${option}`)}
        </Button>
      ))}
    </div>
  );
}
