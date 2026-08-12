import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Task } from "@/entities/task";
import { EditTaskDialog } from "@/features/edit-task";
import { SearchTasksDialog } from "@/features/search-tasks";
import { Logo } from "@/shared/ui";
import { AccountMenu } from "@/widgets/account-menu";

const IS_APPLE =
  typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);
const SHORTCUT_LABEL = IS_APPLE ? "⌘K" : "Ctrl K";

export function AppHeader() {
  const { t } = useTranslation("app-shell");
  const [searchOpen, setSearchOpen] = useState(false);
  // The task outlives `searchOpen` on purpose: unmounting it the moment the
  // edit dialog closes would cut off the popup's exit animation.
  const [editedTask, setEditedTask] = useState<Task | null>(null);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setSearchOpen((open) => !open);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <>
      <header className="sticky top-0 z-40 bg-background/80 pt-3 backdrop-blur-md">
        <div className="mx-auto grid h-16 max-w-[1600px] grid-cols-[auto_1fr_auto] items-center gap-3 px-4 sm:grid-cols-[1fr_minmax(0,28rem)_1fr] sm:gap-6 sm:px-6">
          <Link
            to="/board"
            aria-label={t("home")}
            className="justify-self-start rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {/* Square: the mark fills its 40×40 viewBox edge to edge, so a
                narrower box just letterboxes it instead of cropping. */}
            <Logo className="size-8" />
          </Link>

          {/* A button dressed as an input: the palette needs a dialog, but the
              affordance people look for in a toolbar is a search field. */}
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="flex h-11 w-full min-w-0 items-center gap-2.5 rounded-full border border-border/70 bg-muted/40 py-0 pr-2 pl-4 text-sm text-muted-foreground transition-colors outline-none hover:border-border hover:bg-muted/70 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <Search className="size-4 shrink-0" />
            <span className="min-w-0 flex-1 truncate text-left">{t("search")}</span>
            <kbd className="hidden shrink-0 items-center rounded-full border border-border/70 bg-background px-2 py-1 font-mono text-[10px] font-normal sm:inline-flex">
              {SHORTCUT_LABEL}
            </kbd>
          </button>

          <div className="justify-self-end">
            <AccountMenu />
          </div>
        </div>
      </header>

      <SearchTasksDialog
        open={searchOpen}
        onOpenChange={setSearchOpen}
        onSelectTask={(task) => {
          setSearchOpen(false);
          setEditedTask(task);
          setEditing(true);
        }}
      />
      {editedTask ? (
        <EditTaskDialog task={editedTask} open={editing} onOpenChange={setEditing} />
      ) : null}
    </>
  );
}
