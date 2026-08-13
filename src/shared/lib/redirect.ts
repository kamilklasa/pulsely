// Every route that bounces a user somewhere after auth reads `?redirect=` off the
// URL, which is attacker-controlled. Anything that isn't a single-slash relative
// path — an absolute URL, or the `//host` form browsers treat as protocol-relative
// — would turn the sign-in flow into an open redirect, so it falls back to the board.
export function sanitizeRedirect(target: unknown): string {
  if (typeof target !== "string" || !target.startsWith("/") || target.startsWith("//")) {
    return "/board";
  }
  return target;
}
