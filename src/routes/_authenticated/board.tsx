import { createFileRoute } from "@tanstack/react-router";
import { BoardPage } from "@/pages";

export const Route = createFileRoute("/_authenticated/board")({
  component: BoardPage,
});
