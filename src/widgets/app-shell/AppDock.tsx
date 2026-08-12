import { useMemo, useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { ChartNoAxesColumn, ListChecks, Settings } from "lucide-react";
import { useTranslation } from "react-i18next";
import { SettingsDialog } from "@/features/settings";
import { ActiveTimerBar } from "@/features/track-time";
import { ExpandableActionBar, type ExpandableActionBarItem } from "@/shared/ui";

const SETTINGS_ID = "settings";

// The board's actions live down here rather than in the header: the header
// keeps one job (find something), the dock keeps the other (go somewhere).
export function AppDock() {
  const { t } = useTranslation("app-shell");
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [settingsOpen, setSettingsOpen] = useState(false);

  const items = useMemo<ExpandableActionBarItem[]>(
    () => [
      {
        id: "/board",
        label: t("nav.tasks"),
        icon: <ListChecks className="size-4" />,
        onClick: () => void navigate({ to: "/board" }),
      },
      {
        id: "/reports",
        label: t("nav.reports"),
        icon: <ChartNoAxesColumn className="size-4" />,
        onClick: () => void navigate({ to: "/reports" }),
      },
      {
        id: SETTINGS_ID,
        label: t("nav.settings"),
        icon: <Settings className="size-4" />,
        onClick: () => setSettingsOpen(true),
      },
    ],
    [navigate, t],
  );

  return (
    <>
      {/* The full-width strip is only there to centre both bars without a
          transform — they are layout-animated elements, and motion owns their
          transform. Stacking them in one column keeps the running-task bar
          pinned above the dock without hard-coding the dock's height.
          pointer-events stay off so the strip doesn't swallow clicks on
          whatever sits under it. */}
      <div className="pointer-events-none fixed inset-x-0 bottom-5 z-40 flex flex-col items-center gap-2.5 px-4">
        <ActiveTimerBar />
        <ExpandableActionBar
          items={items}
          activeId={settingsOpen ? SETTINGS_ID : pathname}
          className="pointer-events-auto"
        />
      </div>
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  );
}
