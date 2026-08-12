import { useTranslation } from "react-i18next";
import { KanbanBoard } from "@/widgets/kanban-board";

export function BoardPage() {
  const { t } = useTranslation("board");

  return (
    <>
      {/* The board's own columns are the visible headings; this one is here so
          the page still announces itself to a screen reader. */}
      <h1 className="sr-only">{t("heading")}</h1>
      <KanbanBoard />
    </>
  );
}
