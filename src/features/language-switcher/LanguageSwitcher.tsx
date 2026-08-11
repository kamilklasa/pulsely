import { useTranslation } from "react-i18next";
import { Switch } from "@/shared/ui";
import { cn } from "@/shared/lib/utils";
import { setLocale, useLocale } from "@/shared/i18n";

export function LanguageSwitcher({ className }: { className?: string }) {
  const { t } = useTranslation("common");
  const locale = useLocale();
  const isPolish = locale === "pl";

  return (
    <label className={cn("inline-flex items-center gap-2 text-sm select-none", className)}>
      <span className={cn("transition-colors", isPolish ? "text-muted-foreground" : "font-medium text-foreground")}>
        {t("language.en")}
      </span>
      <Switch
        checked={isPolish}
        onCheckedChange={(checked) => setLocale(checked ? "pl" : "en")}
        aria-label={t("language.label")}
      />
      <span className={cn("transition-colors", isPolish ? "font-medium text-foreground" : "text-muted-foreground")}>
        {t("language.pl")}
      </span>
    </label>
  );
}
