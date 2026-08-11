import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";
import type { SessionStore } from "@/entities/session";
import { LanguageSwitcher } from "@/features/language-switcher";

interface RouterContext {
  auth: SessionStore;
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: () => (
    <>
      <LanguageSwitcher className="fixed top-4 right-4 z-50" />
      <Outlet />
    </>
  ),
});
