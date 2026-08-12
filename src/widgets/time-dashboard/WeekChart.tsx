import { motion, useReducedMotion } from "motion/react";
import { useTranslation } from "react-i18next";
import type { DayTotal } from "@/entities/time-entry";
import { formatDuration, formatWeekday } from "@/features/track-time";
import { startOfDay } from "@/shared/lib/calendar";
import { cn } from "@/shared/lib/utils";

// One series, so one hue and no legend — the panel's own heading names what the
// bars are. sky-600/500 is the board's accent family, and it clears 3:1 against
// the card surface in both themes.
const BAR = "bg-sky-600 dark:bg-sky-500";

// A day with two tracked minutes next to a day with eight hours would round to
// nothing; this is the floor that keeps "worked a little" visibly different
// from "did not work".
const MIN_BAR_PERCENT = 1.5;

const COLUMNS = "flex items-stretch gap-2 sm:gap-3";
const PLOT = "h-44 border-b border-border pt-8";

// The column is as wide as the week divides the panel; the mark inside it is
// capped and centred, so seven days read as bars against a baseline rather than
// as a wall of colour.
const MARK = "mx-auto w-full max-w-12";

// Placeholder bars at the height and rhythm the real ones will have, so the
// panel does not resize under the reader when the entries arrive. It lives here
// rather than in the dashboard because it has to keep sharing this file's
// geometry — the moment it stops, it stops being a preview of the chart.
const SKELETON_PERCENTS = [64, 38, 82, 21, 55, 30, 47];

export function WeekChartSkeleton() {
  return (
    <div aria-hidden className={cn(COLUMNS, PLOT)}>
      {SKELETON_PERCENTS.map((percent, index) => (
        <span key={index} className="flex flex-1 flex-col justify-end">
          <span
            className={cn("animate-pulse rounded-t-[4px] bg-muted", MARK)}
            style={{ height: `${percent}%` }}
          />
        </span>
      ))}
    </div>
  );
}

// Tracked time per day of the current week. Magnitude over an ordered, fixed set
// of buckets — the one job a bar chart is exactly right for.
export function WeekChart({ days, now }: { days: DayTotal[]; now: number }) {
  const { t, i18n } = useTranslation("time-dashboard");
  const reduce = useReducedMotion() ?? false;
  const today = startOfDay(now);
  const peak = days.reduce((highest, day) => Math.max(highest, day.totalMs), 0);

  return (
    <>
      {/* The bars carry no numbers of their own — a duration over every column
          is seven labels to read where the shape already says it. The value is
          on hover, and in the sr-only text for anyone not hovering; the top
          padding is the headroom that hover value needs, since the tallest bar
          fills the plot and its tooltip must land somewhere that isn't the
          heading. */}
      <ul className={cn(COLUMNS, PLOT)}>
        {days.map((day, index) => {
          const duration = formatDuration(day.totalMs);
          const weekday = formatWeekday(day.dayStart, i18n.language);

          return (
            <li
              key={day.dayStart}
              // Each day is a stop of its own: the value lives on hover, and a
              // chart only a mouse can read is a chart half the people using it
              // cannot. Tabbing — or tapping, on a touch screen — puts the same
              // duration on screen, and reads it out for a screen reader.
              tabIndex={0}
              aria-label={t("chart.day", { day: weekday, duration })}
              className="group/day relative flex flex-1 flex-col justify-end rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {day.totalMs > 0 ? (
                <div
                  className={cn("relative", MARK)}
                  style={{ height: `${Math.max(MIN_BAR_PERCENT, (day.totalMs / peak) * 100)}%` }}
                >
                  <span
                    aria-hidden
                    className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 -translate-x-1/2 rounded-md border border-border/70 bg-card px-2 py-0.5 text-xs whitespace-nowrap tabular-nums opacity-0 shadow-sm transition-opacity group-hover/day:opacity-100 group-focus/day:opacity-100"
                  >
                    {duration}
                  </span>
                  {/* Grown from the baseline on mount with a transform, never a
                      height: the bar's height is data, and animating it would
                      lay the page out again on every frame. */}
                  <motion.span
                    aria-hidden
                    initial={reduce ? false : { scaleY: 0 }}
                    animate={{ scaleY: 1 }}
                    transition={{ duration: 0.4, delay: index * 0.04, ease: [0.16, 1, 0.3, 1] }}
                    style={{ transformOrigin: "bottom" }}
                    className={cn("block size-full rounded-t-[4px]", BAR)}
                  />
                </div>
              ) : (
                // A day with nothing on it keeps its column: the week reads as
                // seven slots being filled, not as a chart that changes shape.
                <span
                  aria-hidden
                  className={cn("h-0.5 rounded-full bg-muted-foreground/15", MARK)}
                />
              )}
            </li>
          );
        })}
      </ul>

      {/* A second row rather than a label inside each column: the axis line is
          the ul's own border, and the two rows share a flex rhythm, so the
          labels sit under their bars without either one nesting in the other. */}
      <div aria-hidden className={cn(COLUMNS, "mt-2")}>
        {days.map((day) => (
          <span
            key={day.dayStart}
            className={cn(
              "flex-1 text-center text-xs",
              day.dayStart === today ? "font-medium text-foreground" : "text-muted-foreground",
            )}
          >
            {formatWeekday(day.dayStart, i18n.language)}
          </span>
        ))}
      </div>
    </>
  );
}
