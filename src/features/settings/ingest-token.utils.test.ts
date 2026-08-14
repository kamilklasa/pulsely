import { describe, expect, it } from "vitest";
import {
  generateIngestToken,
  hashIngestToken,
  ingestApiUrl,
  ingestTokenErrorKey,
  InsecureContextError,
  isValidIngestToken,
  wakatimeConfigSnippet,
} from "./ingest-token.utils";

// Assembled rather than written out. These are invented values, but a valid key
// is by design indistinguishable from a WakaTime one, so a literal here trips
// GitHub's secret scanner — and the right fix is to keep that detector armed for
// the day a real key is pasted somewhere, not to allowlist the pattern.
const SAMPLE_UUID = ["0e2f4a3c", "1b6d", "4f8a", "9c3e", "2d5b7a1f4c8e"].join("-");
const SAMPLE_KEY = `waka_${SAMPLE_UUID}`;

// Seam A — pure, no I/O. What this pins down is the contract with a client that
// is not ours to change: a key wakatime-cli rejects, or an api_url it rewrites,
// fails silently on the user's machine with nothing on our side to see.
describe("ingest token format", () => {
  it("generates keys wakatime-cli will accept", () => {
    // Independently of isValidIngestToken, which shares the generator's file and
    // would agree with it even if both were wrong. This is the CLI's own pattern,
    // copied from pkg/params/params.go.
    const cliPattern =
      /^(waka_)?[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

    // Repeated because the parts that can go wrong are random: the version
    // nibble, the variant nibble, and hex case. One sample proves none of them.
    for (let i = 0; i < 200; i++) {
      expect(generateIngestToken()).toMatch(cliPattern);
    }
  });

  it("carries the waka_ prefix so a leaked key is recognisable", () => {
    expect(generateIngestToken().startsWith("waka_")).toBe(true);
  });

  it("gives every key a different value", () => {
    const keys = new Set(Array.from({ length: 500 }, generateIngestToken));
    expect(keys.size).toBe(500);
  });

  it("rejects the shapes the CLI rejects", () => {
    // A bare v4 UUID is legal — the prefix is optional to the CLI.
    expect(isValidIngestToken(SAMPLE_UUID)).toBe(true);
    expect(isValidIngestToken(SAMPLE_KEY)).toBe(true);

    // Uppercase hex: a UUID by any other reading, and still refused.
    expect(isValidIngestToken("waka_0E2F4A3C-1B6D-4F8A-9C3E-2D5B7A1F4C8E")).toBe(false);
    // v1, not v4.
    expect(isValidIngestToken("waka_0e2f4a3c-1b6d-1f8a-9c3e-2d5b7a1f4c8e")).toBe(false);
    // Variant nibble outside [89ab].
    expect(isValidIngestToken("waka_0e2f4a3c-1b6d-4f8a-7c3e-2d5b7a1f4c8e")).toBe(false);
    expect(isValidIngestToken("pulsely_0e2f4a3c-1b6d-4f8a-9c3e-2d5b7a1f4c8e")).toBe(false);
    expect(isValidIngestToken("")).toBe(false);
  });
});

describe("hashIngestToken", () => {
  it("encodes SHA-256 as lowercase hex", async () => {
    // Known answer: a hex conversion that drops a leading zero or flips byte
    // order still looks like a hash, and would only surface as a key that
    // authenticates nowhere.
    await expect(hashIngestToken("abc")).resolves.toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("is stable for one key and distinct across keys", async () => {
    const token = generateIngestToken();

    await expect(hashIngestToken(token)).resolves.toBe(await hashIngestToken(token));
    await expect(hashIngestToken(token)).resolves.not.toBe(
      await hashIngestToken(generateIngestToken()),
    );
    await expect(hashIngestToken(token)).resolves.toMatch(/^[0-9a-f]{64}$/);
  });

  it("covers the prefix, because that is what the CLI sends", async () => {
    const token = generateIngestToken();
    const withoutPrefix = token.slice("waka_".length);

    // If the two agreed, a key would authenticate with or without its prefix and
    // the stored hash would no longer identify one exact string.
    await expect(hashIngestToken(token)).resolves.not.toBe(await hashIngestToken(withoutPrefix));
  });
});

describe("ingestApiUrl", () => {
  it("points at the function, not the endpoint the CLI appends", () => {
    expect(ingestApiUrl("http://127.0.0.1:54321")).toBe(
      "http://127.0.0.1:54321/functions/v1/wakatime",
    );
  });

  it("tolerates a trailing slash on the configured Supabase url", () => {
    expect(ingestApiUrl("https://abc.supabase.co/")).toBe(
      "https://abc.supabase.co/functions/v1/wakatime",
    );
  });

  it("survives normalizeURL, which silently trims some suffixes", () => {
    // pkg/params/params.go strips each of these off api_url before use. A
    // function named `heartbeats` would be truncated to /functions/v1 and every
    // batch posted to the wrong path, with no error anywhere.
    const trimmed = ["/", ".bulk", "/users/current/heartbeats", "/heartbeats", "/heartbeat"];
    const url = ingestApiUrl("https://abc.supabase.co");

    for (const suffix of trimmed) {
      expect(url.endsWith(suffix)).toBe(false);
    }
  });
});

describe("wakatimeConfigSnippet", () => {
  it("is an ini block the CLI reads as settings.api_url and settings.api_key", () => {
    const apiUrl = "https://abc.supabase.co/functions/v1/wakatime";
    const snippet = wakatimeConfigSnippet(apiUrl, SAMPLE_KEY);

    expect(snippet).toBe(`[settings]\napi_url = ${apiUrl}\napi_key = ${SAMPLE_KEY}`);
  });
});

describe("ingestTokenErrorKey", () => {
  it("names the one failure with an action attached", () => {
    expect(ingestTokenErrorKey(new InsecureContextError())).toBe("insecureContext");
  });

  it("falls back to generic for anything it has not seen", () => {
    expect(ingestTokenErrorKey(new Error("network"))).toBe("generic");
    expect(ingestTokenErrorKey(undefined)).toBe("generic");
  });
});
