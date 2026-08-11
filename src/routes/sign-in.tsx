import { createFileRoute, redirect } from "@tanstack/react-router";
import { SignInPage } from "@/pages";

function sanitizeRedirect(target: unknown): string {
  if (typeof target !== "string" || !target.startsWith("/") || target.startsWith("//")) {
    return "/board";
  }
  return target;
}

export const Route = createFileRoute("/sign-in")({
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: sanitizeRedirect(search.redirect),
  }),
  beforeLoad: async ({ context, search }) => {
    await context.auth.ensureInitialized();
    if (context.auth.getSnapshot().status === "authenticated") {
      throw redirect({ to: search.redirect });
    }
  },
  component: SignInPage,
});
