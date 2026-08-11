import { useTranslation } from "react-i18next";
import { useSession } from "@/entities/session";
import { SignOutButton } from "@/features/sign-out";
import { KanbanBoard } from "@/widgets/kanban-board";

export function BoardPage() {
  const { t } = useTranslation("board");
  const { session } = useSession();

  return (
    <div className="flex flex-col items-start gap-6 p-8">
      <div className="flex w-full items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">{t("heading")}</h1>
          <p className="text-muted-foreground">{t("signedInAs", { email: session?.user.email })}</p>
        </div>
        <SignOutButton />
      </div>
      <KanbanBoard />
    </div>
  );
}
