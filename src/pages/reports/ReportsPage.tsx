import { useTranslation } from "react-i18next";
import { TimeDashboard } from "@/widgets/time-dashboard";

export function ReportsPage() {
  const { t } = useTranslation("reports");

  return (
    <>
      <h1 className="text-lg font-semibold tracking-tight">{t("heading")}</h1>
      <p className="mt-1 max-w-[55ch] text-sm leading-relaxed text-muted-foreground">
        {t("subheading")}
      </p>

      <TimeDashboard />
    </>
  );
}
