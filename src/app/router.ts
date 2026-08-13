import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { sessionStore } from "@/entities/session";
import { routeTree } from "../routeTree.gen";

export const queryClient = new QueryClient();

export const router = createRouter({
  routeTree,
  context: {
    auth: sessionStore,
    queryClient,
  },
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

// Signing out never emptied the query cache, so signing in as somebody else in
// the same tab used to hand the new session the previous user's cached data —
// including their enrolled MFA factors. Keyed on the user id, not on the
// snapshot: a token refresh re-emits the same user and must not wipe the cache.
let cachedUserId: string | undefined;

sessionStore.subscribe(() => {
  const userId = sessionStore.getSnapshot().session?.user.id;
  if (userId !== cachedUserId) {
    cachedUserId = userId;
    queryClient.clear();
  }

  void router.invalidate();
});
