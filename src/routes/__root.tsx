import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";
import type { SessionStore } from "@/entities/session";

interface RouterContext {
  auth: SessionStore;
  queryClient: QueryClient;
}

// Each page places its own LanguageSwitcher rather than one global fixed
// overlay — the board's toolbar has other top-right controls (sign out) that
// a fixed-position switcher would sit on top of and collide with.
export const Route = createRootRouteWithContext<RouterContext>()({
  component: () => <Outlet />,
});
