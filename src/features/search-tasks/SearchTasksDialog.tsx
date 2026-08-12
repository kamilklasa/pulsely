import { useEffect, useId, useMemo, useState } from "react";
import { CornerDownLeft, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useTasks, type Task } from "@/entities/task";
import { Dialog, DialogClose, DialogPopup, DialogTitle } from "@/shared/ui";
import { cn } from "@/shared/lib/utils";
import { matchRange, searchTasks } from "./search-tasks.utils";

// Wraps the slice of `text` the query matched in a <mark>, so a result makes
// it obvious *why* it is on the list — especially for description-only hits.
function Highlighted({ text, query }: { text: string; query: string }) {
  const range = query.trim() ? matchRange(text, query.trim()) : null;
  if (!range) return <>{text}</>;

  const [start, end] = range;
  return (
    <>
      {text.slice(0, start)}
      <mark className="rounded-[3px] bg-primary/10 px-0.5 font-medium text-foreground">
        {text.slice(start, end)}
      </mark>
      {text.slice(end)}
    </>
  );
}

function KeyHint({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex h-4 min-w-4 items-center justify-center rounded border border-border/70 bg-background px-1 font-mono text-[10px] font-normal text-muted-foreground">
      {children}
    </kbd>
  );
}

function SearchResults({
  results,
  query,
  activeIndex,
  optionId,
  onSelect,
  onHover,
}: {
  results: Task[];
  query: string;
  activeIndex: number;
  optionId: (index: number) => string;
  onSelect: (task: Task) => void;
  onHover: (index: number) => void;
}) {
  const { t } = useTranslation("search-tasks");
  const { t: tTask } = useTranslation("task");

  return (
    <>
      {/* The rows are options of an aria-activedescendant listbox, not buttons —
          focus never leaves the query input, so they must not be tab stops. */}
      {results.map((task, index) => (
        <li
          key={task.id}
          id={optionId(index)}
          role="option"
          aria-selected={index === activeIndex}
          onMouseMove={() => onHover(index)}
          onClick={() => onSelect(task)}
          className={cn(
            "flex cursor-default items-center gap-3 rounded-lg px-2.5 py-2 transition-colors",
            index === activeIndex && "bg-muted",
          )}
        >
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm">
              <Highlighted text={task.title} query={query} />
            </span>
            {task.description ? (
              <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                <Highlighted text={task.description} query={query} />
              </span>
            ) : null}
          </span>
          <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
            {tTask(`columns.${task.status}`)}
          </span>
        </li>
      ))}
      {results.length === 0 ? (
        <li className="px-2.5 py-8 text-center text-sm text-muted-foreground">
          {query.trim() ? t("noResults", { query: query.trim() }) : t("noTasks")}
        </li>
      ) : null}
    </>
  );
}

export function SearchTasksDialog({
  open,
  onOpenChange,
  onSelectTask,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectTask: (task: Task) => void;
}) {
  const { t } = useTranslation("search-tasks");
  const { data: tasks, isPending } = useTasks();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const listId = useId();
  const optionId = (index: number) => `${listId}-option-${index}`;

  const results = useMemo(() => searchTasks(tasks ?? [], query), [tasks, query]);

  // Each reopen is a fresh search; leaving the previous query in place would
  // hide most of the board behind a filter the user forgot they typed.
  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
    }
  }, [open]);

  // The list scrolls, so the highlighted row has to be dragged into view as
  // the arrow keys walk past the fold.
  useEffect(() => {
    document
      .getElementById(`${listId}-option-${activeIndex}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, listId, results]);

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (results.length ? (index + 1) % results.length : 0));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) =>
        results.length ? (index - 1 + results.length) % results.length : 0,
      );
    } else if (event.key === "Enter") {
      const task = results[activeIndex];
      if (task) {
        event.preventDefault();
        onSelectTask(task);
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup hideClose className="top-[12vh] max-w-xl translate-y-0 overflow-hidden p-0">
        <DialogTitle className="sr-only">{t("heading")}</DialogTitle>

        <div className="flex items-center gap-2.5 border-b border-border/60 px-4">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          {/* A palette you have to click into before typing is a broken palette. */}
          <input
            autoFocus
            type="text"
            role="combobox"
            aria-expanded
            aria-controls={listId}
            aria-activedescendant={results.length ? optionId(activeIndex) : undefined}
            aria-label={t("heading")}
            placeholder={t("placeholder")}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={handleKeyDown}
            className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>

        <ul
          id={listId}
          role="listbox"
          aria-label={t("heading")}
          className="max-h-[min(22rem,50vh)] overflow-y-auto p-1.5"
        >
          {isPending ? (
            // Skeleton rows rather than a spinner: the palette keeps its height
            // and the results slot in place instead of shoving the footer down.
            Array.from({ length: 3 }, (_, index) => (
              <li key={index} className="px-2.5 py-2.5">
                <span className="block h-3.5 w-2/3 animate-pulse rounded bg-muted" />
              </li>
            ))
          ) : (
            <SearchResults
              results={results}
              query={query}
              activeIndex={activeIndex}
              optionId={optionId}
              onSelect={onSelectTask}
              onHover={setActiveIndex}
            />
          )}
        </ul>

        <div className="flex items-center justify-between gap-3 border-t border-border/60 bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <KeyHint>↑</KeyHint>
              <KeyHint>↓</KeyHint>
              {t("hints.navigate")}
            </span>
            <span className="flex items-center gap-1">
              <KeyHint>
                <CornerDownLeft className="size-2.5" />
              </KeyHint>
              {t("hints.open")}
            </span>
          </div>
          {/* Stands in for the popup's corner X, which would land on the input. */}
          <DialogClose className="rounded-md px-1.5 py-0.5 outline-none transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50">
            {t("hints.close")}
          </DialogClose>
        </div>
      </DialogPopup>
    </Dialog>
  );
}
