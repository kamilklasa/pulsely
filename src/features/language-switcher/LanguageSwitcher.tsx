import { useTranslation } from "react-i18next";
import {
  GbFlagIcon,
  PlFlagIcon,
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui";
import { cn } from "@/shared/lib/utils";
import { type Locale, setLocale, useLocale } from "@/shared/i18n";

const FLAG_ICONS: Record<Locale, typeof GbFlagIcon> = {
  en: GbFlagIcon,
  pl: PlFlagIcon,
};

export function LanguageSwitcher({ className }: { className?: string }) {
  const { t } = useTranslation("common");
  const locale = useLocale();

  return (
    <Select
      value={locale}
      onValueChange={(value) => setLocale(value as Locale)}
      items={[
        { value: "en", label: t("language.en") },
        { value: "pl", label: t("language.pl") },
      ]}
    >
      <SelectTrigger className={cn(className)} aria-label={t("language.label")}>
        <SelectValue>
          {(value: Locale) => {
            const FlagIcon = FLAG_ICONS[value];
            return (
              <span className="flex items-center gap-2">
                <FlagIcon />
                {t(`language.${value}`)}
              </span>
            );
          }}
        </SelectValue>
      </SelectTrigger>
      <SelectPopup>
        {(Object.keys(FLAG_ICONS) as Locale[]).map((option) => {
          const FlagIcon = FLAG_ICONS[option];
          return (
            <SelectItem key={option} value={option}>
              <FlagIcon />
              {t(`language.${option}`)}
            </SelectItem>
          );
        })}
      </SelectPopup>
    </Select>
  );
}
