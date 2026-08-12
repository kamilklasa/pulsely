import { LayoutGroup, motion, useReducedMotion, type Transition } from "motion/react";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FocusEvent,
  type ReactNode,
} from "react";

import { cn } from "@/shared/lib/utils";

// Ported from the beui "Expandable Action Bar" block (MIT) and trimmed to the
// parts this app uses — the badge/renderItem/size knobs went with it.
export interface ExpandableActionBarItem {
  id: string;
  label: string;
  icon: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}

const ITEM_TRANSITION: Transition = { type: "spring", stiffness: 460, damping: 34, mass: 0.62 };
const LABEL_TRANSITION: Transition = { type: "spring", stiffness: 380, damping: 32, mass: 0.7 };

export function ExpandableActionBar({
  items,
  activeId,
  collapseDelay = 90,
  className,
}: {
  items: ExpandableActionBarItem[];
  activeId?: string;
  collapseDelay?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  // Namespaces the highlight's layoutId so two bars on one page can't animate
  // their pills into each other.
  const groupId = useId();
  const [expanded, setExpanded] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const collapseTimer = useRef<number | null>(null);

  const clearCollapseTimer = useCallback(() => {
    if (collapseTimer.current) window.clearTimeout(collapseTimer.current);
    collapseTimer.current = null;
  }, []);

  const open = useCallback(() => {
    clearCollapseTimer();
    setExpanded(true);
  }, [clearCollapseTimer]);

  // The grace period keeps the bar open while the pointer crosses the gap
  // between two items, which would otherwise read as a flicker.
  const close = useCallback(() => {
    clearCollapseTimer();
    collapseTimer.current = window.setTimeout(() => {
      setExpanded(false);
      setHoveredId(null);
    }, collapseDelay);
  }, [clearCollapseTimer, collapseDelay]);

  useEffect(() => clearCollapseTimer, [clearCollapseTimer]);

  function handleBlur(event: FocusEvent<HTMLDivElement>) {
    if (!event.currentTarget.contains(event.relatedTarget)) close();
  }

  const highlightId = hoveredId ?? activeId;

  return (
    <LayoutGroup id={groupId}>
      <motion.div
        layout="size"
        transition={ITEM_TRANSITION}
        onMouseEnter={open}
        onMouseLeave={() => {
          setHoveredId(null);
          close();
        }}
        onFocus={open}
        onBlur={handleBlur}
        className={cn(
          "relative inline-flex min-h-11 items-center gap-1.5 rounded-full border border-border/70 bg-card/85 p-1.5 text-sm shadow-[0_16px_40px_-12px_rgb(0_0_0/0.18)] backdrop-blur-xl",
          className,
        )}
      >
        {items.map((item) => {
          const isHighlighted = highlightId === item.id;

          return (
            <motion.button
              key={item.id}
              layout="position"
              type="button"
              disabled={item.disabled}
              title={item.label}
              aria-current={activeId === item.id ? "page" : undefined}
              onMouseEnter={() => {
                clearCollapseTimer();
                setHoveredId(item.id);
              }}
              onClick={(event) => {
                // Without this the pressed item keeps focus and pins the bar
                // open after the pointer has long left it.
                event.currentTarget.blur();
                item.onClick?.();
              }}
              whileTap={reduce || item.disabled ? undefined : { scale: 0.96 }}
              transition={ITEM_TRANSITION}
              className={cn(
                "relative isolate inline-flex h-8 min-w-8 items-center justify-center rounded-full px-2 font-medium text-muted-foreground outline-none transition-colors duration-150 ease-out focus-visible:text-foreground disabled:pointer-events-none disabled:opacity-40",
                isHighlighted && "text-foreground",
              )}
            >
              {isHighlighted ? (
                <motion.span
                  layoutId="action-bar-highlight"
                  transition={ITEM_TRANSITION}
                  className="absolute inset-0 -z-10 rounded-full bg-primary/8"
                />
              ) : null}

              <span className="inline-flex size-4 shrink-0 items-center justify-center">
                {item.icon}
              </span>

              <motion.span
                aria-hidden={!expanded}
                animate={{
                  width: expanded ? "auto" : 0,
                  opacity: expanded ? 1 : 0,
                  marginLeft: expanded ? 8 : 0,
                  ...(reduce
                    ? {}
                    : { x: expanded ? 0 : -4, filter: expanded ? "blur(0px)" : "blur(3px)" }),
                }}
                transition={reduce ? { duration: 0 } : LABEL_TRANSITION}
                className="inline-block overflow-hidden whitespace-nowrap"
              >
                {item.label}
              </motion.span>
            </motion.button>
          );
        })}
      </motion.div>
    </LayoutGroup>
  );
}
