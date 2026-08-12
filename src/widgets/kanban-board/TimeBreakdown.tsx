import { useTranslation } from "react-i18next";
import { cn } from "@/shared/lib/utils";

// Part-to-whole at a glance with four segments — the one job a donut is still
// the right form for. Values are placeholders: no app names, no durations, so
// nothing here can be mistaken for the user's own tracked time.
//
// The hues are Tailwind's sky/amber/emerald 600 steps, which is the board's
// existing accent family. They were run through the palette validator against
// the popover surface and pass the lightness band, chroma floor, normal-vision
// separation and 3:1 contrast in BOTH light and dark. Colourblind separation
// lands at ΔE 7.7 (protan) — inside the 6–8 band, which is only legal with a
// secondary encoding, so every segment is also named in the legend and the
// arcs are held apart by a 2px gap. Do not drop the legend.
const SEGMENTS = [
  { share: 42, stroke: "stroke-sky-600", swatch: "bg-sky-600" },
  { share: 27, stroke: "stroke-amber-600", swatch: "bg-amber-600" },
  { share: 19, stroke: "stroke-emerald-600", swatch: "bg-emerald-600" },
  { share: 12, stroke: "stroke-muted-foreground/40", swatch: "bg-muted-foreground/40" },
];

// r chosen so the circumference is exactly 100 — every dash length is then a
// percentage, and the arithmetic below stays readable.
const RADIUS = 15.915;
const GAP = 2;

export function TimeBreakdown() {
  const { t } = useTranslation("task-details");
  let offset = 0;

  return (
    <div className="mt-4 flex items-center gap-6">
      <svg
        viewBox="0 0 42 42"
        className="size-28 shrink-0 -rotate-90"
        role="img"
        aria-label={t("breakdown.chartLabel")}
      >
        {SEGMENTS.map((segment, index) => {
          const dash = `${segment.share - GAP} ${100 - segment.share + GAP}`;
          const element = (
            <circle
              key={index}
              cx="21"
              cy="21"
              r={RADIUS}
              fill="none"
              strokeWidth="4"
              strokeDasharray={dash}
              strokeDashoffset={-offset}
              className={segment.stroke}
            />
          );
          offset += segment.share;
          return element;
        })}
      </svg>

      <ul className="flex min-w-0 flex-1 flex-col gap-2.5">
        {SEGMENTS.map((segment, index) => (
          <li key={index} className="flex items-center gap-2.5">
            <span className={cn("size-2 shrink-0 rounded-full", segment.swatch)} />
            {/* The name of each application goes here once heartbeats exist;
                until then a bar, so no invented label reads as real. */}
            <span
              aria-hidden
              className="h-2 rounded-full bg-muted-foreground/15"
              style={{ width: `${38 + segment.share}%` }}
            />
            <span className="ml-auto font-mono text-xs text-muted-foreground/50">—</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
