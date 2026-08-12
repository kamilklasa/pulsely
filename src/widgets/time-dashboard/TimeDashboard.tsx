import { useTranslation } from "react-i18next";
import {
  dayTotalMs,
  findRunningEntry,
  useTimeEntries,
  weekDayTotals,
  weekTotalMs,
} from "@/entities/time-entry";
import { formatDuration, useLiveNow } from "@/features/track-time";
import { cn } from "@/shared/lib/utils";
import { WeekChart, WeekChartSkeleton } from "./WeekChart";

const PANEL = "rounded-2xl border border-border/80 p-6 sm:p-8";

// The two numbers the dashboard exists for. They are read at a glance and
// compared against each other, so they share a scale and a tabular figure width
// — a total that reflows as its digits tick would be unreadable while running.
function Total({
  label,
  durationMs,
  live = false,
  liveLabel,
}: {
  label: string;
  durationMs: number;
  live?: boolean;
  liveLabel?: string;
}) {
  return (
    <div>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums">
        {formatDuration(durationMs)}
      </p>
      {live ? (
        <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          <span
            aria-hidden
            className="size-1.5 shrink-0 rounded-full bg-emerald-600 dark:bg-emerald-400"
          />
          {liveLabel}
        </p>
      ) : null}
    </div>
  );
}

function TotalSkeleton({ label }: { label: string }) {
  return (
    <div>
      <p className="text-sm text-muted-foreground">{label}</p>
      <span className="mt-2 block h-7 w-24 animate-pulse rounded-md bg-muted" />
    </div>
  );
}

// Today and this week, both including whatever is running right now — the whole
// point of taking `now` through the aggregation rather than summing stored
// durations, which would leave the numbers frozen for the length of a run.
export function TimeDashboard() {
  const { t } = useTranslation("time-dashboard");
  const { data, isPending } = useTimeEntries();
  const now = useLiveNow();

  const entries = data ?? [];
  const running = findRunningEntry(entries) !== null;
  const week = weekTotalMs(entries, now);

  return (
    <div className="mt-8 grid gap-4 lg:grid-cols-[1.7fr_1fr]">
      <section className={PANEL} aria-labelledby="week-chart-title">
        <h2 id="week-chart-title" className="text-sm font-medium">
          {t("chart.title")}
        </h2>

        <div className="mt-6">
          {isPending ? (
            <WeekChartSkeleton />
          ) : week === 0 ? (
            // Nothing tracked this week yet: bars at zero would read as a chart
            // that had failed to load, so the panel says what fills it instead.
            <div className="flex h-44 flex-col justify-center">
              <p className="text-sm font-medium">{t("empty.title")}</p>
              <p className="mt-1 max-w-[45ch] text-sm leading-relaxed text-muted-foreground">
                {t("empty.description")}
              </p>
            </div>
          ) : (
            <WeekChart days={weekDayTotals(entries, now)} now={now} />
          )}
        </div>
      </section>

      <section className={cn(PANEL, "flex flex-col justify-center gap-8")}>
        {isPending ? (
          <>
            <TotalSkeleton label={t("today")} />
            <TotalSkeleton label={t("week")} />
          </>
        ) : (
          <>
            <Total
              label={t("today")}
              durationMs={dayTotalMs(entries, now)}
              live={running}
              liveLabel={t("running")}
            />
            <Total label={t("week")} durationMs={week} />
          </>
        )}
      </section>
    </div>
  );
}
