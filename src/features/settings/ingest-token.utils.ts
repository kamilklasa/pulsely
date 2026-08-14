// The key format is not ours to pick. wakatime-cli validates api_key against
// this exact pattern in pkg/params/params.go and refuses to send a single
// heartbeat if it fails — a longer, higher-entropy string would be rejected
// before it ever reached us. It is a v4 UUID, lowercase hex, with an optional
// `waka_` prefix.
const WAKATIME_API_KEY_PATTERN =
  /^(waka_)?[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

// The prefix is optional to the CLI and worth keeping anyway: it makes a leaked
// key recognisable as one in a log or a screenshot, and tells the user which of
// the several UUIDs in their config is the credential.
const TOKEN_PREFIX = "waka_";

// crypto.subtle exists only in a secure context, so a deployment served over
// plain http can generate a key but never hash it. Its own error type because
// the fix is "open the app over https", which "try again" does not cover.
export class InsecureContextError extends Error {
  override name = "InsecureContextError";

  constructor() {
    super("Web Crypto is unavailable outside a secure context");
  }
}

export function isValidIngestToken(token: string): boolean {
  return WAKATIME_API_KEY_PATTERN.test(token);
}

// 122 random bits from the platform CSPRNG. The plaintext exists only in the tab
// that made it: the caller shows it once and stores nothing but its hash, so no
// request, log or database row ever carries the key itself.
export function generateIngestToken(): string {
  return `${TOKEN_PREFIX}${crypto.randomUUID()}`;
}

// Hashes the whole string including the prefix — the ingest function hashes the
// credential exactly as the CLI sends it, so both sides have to agree on what
// "the key" is down to the byte.
export async function hashIngestToken(token: string): Promise<string> {
  if (!crypto.subtle) throw new InsecureContextError();

  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

// wakatime-cli appends `/users/current/heartbeats.bulk` to whatever api_url it
// is given, so this is the base the function serves under, not the endpoint.
//
// The function is named `wakatime` rather than `heartbeats` on purpose:
// normalizeURL in pkg/params/params.go strips a trailing `/heartbeats` from
// api_url, so the obvious name would be silently truncated to `/functions/v1`
// and every batch would be posted to the wrong place.
export function ingestApiUrl(supabaseUrl: string): string {
  return `${supabaseUrl.replace(/\/+$/, "")}/functions/v1/wakatime`;
}

// The block the user pastes into ~/.wakatime.cfg. Viper reads it as an ini file,
// so both values live under [settings] — that is where the CLI looks for
// `settings.api_url` and `settings.api_key`.
export function wakatimeConfigSnippet(apiUrl: string, token: string): string {
  return `[settings]\napi_url = ${apiUrl}\napi_key = ${token}`;
}

// One key per message the WakaTime row can show, same closed-union shape as
// integrationErrorKey: an error this file has never seen lands on "generic",
// never on a missing message.
export type IngestTokenErrorKey = "insecureContext" | "generic";

export function ingestTokenErrorKey(error: unknown): IngestTokenErrorKey {
  if (error instanceof InsecureContextError) return "insecureContext";

  return "generic";
}
