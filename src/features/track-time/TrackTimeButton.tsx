import { Pause, Play } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/ui";
import { cn } from "@/shared/lib/utils";
import type { Stopwatch } from "./track-time.hooks";
import { formatDuration } from "./track-time.utils";

export function TrackTimeButton({
  stopwatch,
  size = "xs",
}: {
  stopwatch: Stopwatch;
  size?: "xs" | "sm";
}) {
  const { t } = useTranslation("track-time");
  const { elapsedMs, running, toggle } = stopwatch;
  const duration = formatDuration(elapsedMs);

  return (
    <div className="flex items-center gap-2">
      {/* Emerald reuses the board's existing "done" accent rather than adding a
          second colour to the palette; the tint stays low so a column full of
          cards doesn't turn into a wall of green. */}
      <Button
        type="button"
        variant="ghost"
        size={size}
        onClick={toggle}
        className={cn(
          "rounded-full bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-400",
          running && "bg-emerald-500/20",
        )}
      >
        {running ? <Pause /> : <Play />}
        {running ? t("stop") : t("start")}
      </Button>
      {/* No aria-live: a counter that announces itself every quarter second
          would talk over everything else on the page. The label carries the
          value for anyone who lands on it. */}
      <span
        aria-label={t("elapsed", { duration })}
        className={cn(
          "text-xs tabular-nums",
          running ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground/70",
        )}
      >
        {duration}
      </span>
    </div>
  );
}
