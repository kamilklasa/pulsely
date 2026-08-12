import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Square } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useTasks } from "@/entities/task";
import { Button } from "@/shared/ui";
import { useActiveTimer } from "./track-time.hooks";
import { formatDuration } from "./track-time.utils";

// A symmetric curve is the right call here, unlike in UI state transitions:
// the grid breathes in and out forever, and an asymmetric ease would make one
// half of every cycle look rushed.
const BREATHE = [0.45, 0, 0.55, 1] as const;
const CELL_COUNT = 9;
const STAGGER = 0.14;

// Ported from the beui "agent progress" loading state — a 3×3 grid whose cells
// pulse on a staggered loop, standing in for a spinner.
function PulseGrid() {
  const reduce = useReducedMotion() ?? false;

  return (
    <span aria-hidden className="grid size-4 shrink-0 grid-cols-3 gap-px">
      {Array.from({ length: CELL_COUNT }, (_, index) => (
        <motion.span
          key={index}
          className="rounded-[1px] bg-red-500 dark:bg-red-400"
          animate={
            reduce
              ? { opacity: [0.35, 0.8, 0.35] }
              : { opacity: [0.28, 1, 0.28], scale: [0.72, 1, 0.72] }
          }
          transition={{
            duration: 1.55,
            ease: BREATHE,
            repeat: Infinity,
            delay: index * STAGGER,
          }}
        />
      ))}
    </span>
  );
}

export function ActiveTimerBar() {
  const { t } = useTranslation("track-time");
  const active = useActiveTimer();
  const { data: tasks } = useTasks();
  const task = active ? tasks?.find((candidate) => candidate.id === active.taskId) : undefined;

  return (
    <AnimatePresence>
      {active && task ? (
        <motion.div
          role="status"
          initial={{ opacity: 0, y: 10, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.96 }}
          transition={{ type: "spring", stiffness: 420, damping: 34, mass: 0.6 }}
          // min-w is a floor, not a width: it stops a two-word task from
          // shrinking the pill to a stub, while a longer title still grows it
          // until the truncation on the title itself takes over.
          className="pointer-events-auto flex min-w-60 items-center gap-2.5 rounded-full border border-border/70 bg-card/85 py-2 pr-2 pl-4 shadow-[0_16px_40px_-12px_rgb(0_0_0/0.18)] backdrop-blur-xl"
        >
          <PulseGrid />
          <span className="min-w-0 flex-1 truncate text-sm font-medium">{task.title}</span>
          <span className="shrink-0 text-xs tabular-nums">{formatDuration(active.elapsedMs)}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t("stop")}
            onClick={active.stop}
            className="shrink-0 rounded-full text-muted-foreground bg-muted hover:text-foreground"
          >
            <Square className="size-3 fill-current" />
          </Button>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
