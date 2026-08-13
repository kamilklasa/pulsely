import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
// Straight at the modules, not the slice barrel: `beforeLoad` is not code-split,
// so a barrel that also re-exports the dialogs would pull all of them — and
// everything they import — into this guard's chunk.
import { readAssuranceLevel } from "@/features/two-factor/two-factor.data";
import { requiresChallenge } from "@/features/two-factor/two-factor.utils";
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

    // A session with a factor enrolled is signed in but not yet at the assurance
    // level the account asks for. Turning it back here — before the child
    // loaders run — is what stops the board rendering behind the challenge.
    if (requiresChallenge(await readAssuranceLevel())) {
      throw redirect({
        to: "/two-factor",
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
