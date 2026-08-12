import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { AppShell } from "@/widgets/app-shell";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async ({ context, location }) => {
    await context.auth.ensureInitialized();
    if (context.auth.getSnapshot().status !== "authenticated") {
      throw redirect({
        to: "/sign-in",
        search: { redirect: location.href },
      });
    }
  },
  // Header and dock hang off the authenticated layout rather than each page,
  // so every signed-in screen gets the same chrome for free.
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
});
