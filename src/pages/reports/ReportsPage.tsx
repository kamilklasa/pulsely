import { ChartNoAxesColumn } from "lucide-react";
import { useTranslation } from "react-i18next";

// Deliberately unlabelled: a placeholder chart with plausible-looking numbers
// on it would be read as data. These are just bars.
const BAR_HEIGHTS = [38, 62, 47, 71, 55, 83, 44];

export function ReportsPage() {
  const { t } = useTranslation("reports");

  return (
    <>
      <h1 className="text-lg font-semibold tracking-tight">{t("heading")}</h1>
      <p className="mt-1 max-w-[55ch] text-sm leading-relaxed text-muted-foreground">
        {t("subheading")}
      </p>

      <div className="mt-8 grid gap-4 lg:grid-cols-[1.7fr_1fr]">
        <div className="rounded-2xl border border-dashed border-border/80 p-6 sm:p-8">
          <div aria-hidden className="flex h-40 items-end gap-2 sm:gap-3" style={{ opacity: 0.35 }}>
            {BAR_HEIGHTS.map((height, index) => (
              <div
                key={index}
                className="flex-1 rounded-t-md bg-muted-foreground/30"
                style={{ height: `${height}%` }}
              />
            ))}
          </div>
          <div aria-hidden className="mt-3 h-px bg-border" />
        </div>

        <div className="flex flex-col justify-center gap-3 rounded-2xl border border-dashed border-border/80 p-6 sm:p-8">
          <ChartNoAxesColumn className="size-5 text-muted-foreground" />
          <p className="text-sm font-medium">{t("empty.title")}</p>
          <p className="text-sm leading-relaxed text-muted-foreground">{t("empty.description")}</p>
        </div>
      </div>
    </>
  );
}
