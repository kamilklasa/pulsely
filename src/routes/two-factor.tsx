import { createFileRoute, redirect } from "@tanstack/react-router";
// See _authenticated.tsx — the guard reaches past the barrel on purpose.
import { readAssuranceLevel } from "@/features/two-factor/two-factor.data";
import { requiresChallenge } from "@/features/two-factor/two-factor.utils";
import { TwoFactorPage } from "@/pages";
import { sanitizeRedirect } from "@/shared/lib/redirect";

// Its own route rather than an overlay on the board: a session that still owes a
// code must not get as far as running the board's loaders.
export const Route = createFileRoute("/two-factor")({
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: sanitizeRedirect(search.redirect),
  }),
  beforeLoad: async ({ context, search }) => {
    await context.auth.ensureInitialized();
    if (context.auth.getSnapshot().status !== "authenticated") {
      throw redirect({ to: "/sign-in", search: { redirect: search.redirect } });
    }

    // Nothing to answer — reached by a stale link, or by coming back after the
    // code already landed.
    if (!requiresChallenge(await readAssuranceLevel())) throw redirect({ to: search.redirect });
  },
  component: TwoFactorPage,
});
