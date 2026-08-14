import { describe, expect, it } from "vitest";
import type { TimeEntry } from "@/entities/time-entry";
import { attributeHeartbeat, editorFromUserAgent } from "./heartbeat.utils";

function entry(id: string, startedAt: string, stoppedAt: string | null): TimeEntry {
  return { id, task_id: "task", started_at: startedAt, stopped_at: stoppedAt, source: "manual" };
}

const iso = (time: string) => `2026-08-14T${time}Z`;
const at = (time: string) => Date.parse(iso(time));

// Two runs that meet exactly, a gap, then a run still going — the shape a real
// morning produces, because starting a timer stops the previous run at the new
// one's start instant rather than a millisecond before it.
const RUN_A = entry("a", iso("10:00:00.000"), iso("11:00:00.000"));
const RUN_B = entry("b", iso("11:00:00.000"), iso("12:00:00.000"));
const RUN_OPEN = entry("open", iso("13:00:00.000"), null);
const ENTRIES = [RUN_A, RUN_B, RUN_OPEN];
const NOW = at("14:00:00.000");

describe("attributeHeartbeat", () => {
  it("files a heartbeat against the run it happened during", () => {
    expect(attributeHeartbeat(ENTRIES, at("10:30:00.000"), NOW)).toBe("a");
    expect(attributeHeartbeat(ENTRIES, at("11:30:00.000"), NOW)).toBe("b");
  });

  it("includes the instant a run starts", () => {
    expect(attributeHeartbeat([RUN_A], at("10:00:00.000"), NOW)).toBe("a");
  });

  it("gives a shared boundary to the run that is beginning", () => {
    // 11:00:00.000 is A's stopped_at and B's started_at, to the millisecond.
    // Closing both ends of the window would count this instant twice.
    expect(attributeHeartbeat(ENTRIES, at("11:00:00.000"), NOW)).toBe("b");
  });

  it("excludes the instant a run stops when nothing follows it", () => {
    // B ends at 12:00 and the next run does not start until 13:00, so this
    // timestamp belongs to no run at all rather than to the one just ended.
    expect(attributeHeartbeat(ENTRIES, at("12:00:00.000"), NOW)).toBeNull();
  });

  it("attributes to the open run, up to and including now", () => {
    expect(attributeHeartbeat(ENTRIES, at("13:30:00.000"), NOW)).toBe("open");
    expect(attributeHeartbeat(ENTRIES, NOW, NOW)).toBe("open");
  });

  it("drops a timestamp from a clock running fast", () => {
    // Past `now` there is no run to speak of — inventing one would let a wrong
    // clock write time the user never tracked.
    expect(attributeHeartbeat(ENTRIES, NOW + 1, NOW)).toBeNull();
  });

  it("drops a heartbeat from before, between and after every run", () => {
    expect(attributeHeartbeat(ENTRIES, at("09:59:59.999"), NOW)).toBeNull();
    expect(attributeHeartbeat(ENTRIES, at("12:30:00.000"), NOW)).toBeNull();
    // No open run: typing carried on after the timer was stopped.
    expect(attributeHeartbeat([RUN_A, RUN_B], at("12:30:00.000"), NOW)).toBeNull();
  });

  it("reports no match as a value, not a failure", () => {
    // The ingest function has to tell "nothing to attribute this to" apart from
    // "something went wrong": the first is a 2xx that stores nothing, the second
    // must not be swallowed as one.
    expect(() => attributeHeartbeat([], at("10:30:00.000"), NOW)).not.toThrow();
    expect(attributeHeartbeat([], at("10:30:00.000"), NOW)).toBeNull();
  });

  it("prefers the later run if two somehow overlap", () => {
    // The single-active-timer rule makes this unreachable from one device; a
    // second device racing a stale cache is the way it happens anyway.
    const overlapping = [
      entry("early", iso("10:00:00.000"), iso("11:00:00.000")),
      entry("late", iso("10:30:00.000"), iso("11:00:00.000")),
    ];

    expect(attributeHeartbeat(overlapping, at("10:45:00.000"), NOW)).toBe("late");
  });
});

describe("editorFromUserAgent", () => {
  it("reads the editor out of a plugin pair", () => {
    expect(
      editorFromUserAgent(
        "wakatime/v1.73.0 (darwin-23.0.0-arm64) go1.21.0 vscode/1.85.0 vscode-wakatime/24.0.0",
      ),
    ).toBe("vscode");
  });

  it("strips the -wakatime suffix a single-token plugin carries", () => {
    expect(
      editorFromUserAgent("wakatime/v1.73.0 (linux-6.1-amd64) go1.21.0 vim-wakatime/9.0.1"),
    ).toBe("vim");
  });

  it("survives an OS string with a space in it", () => {
    // Read from the last ')', not by counting tokens — this is the case that
    // would drift on exactly the platforms we cannot test locally.
    expect(
      editorFromUserAgent(
        "wakatime/v1.73.0 (Windows Server 2022-10.0.20348-amd64) go1.21.0 vscode/1.85.0 vscode-wakatime/24.0.0",
      ),
    ).toBe("vscode");
  });

  it("records an unidentified plugin as unknown rather than naming it", () => {
    expect(
      editorFromUserAgent("wakatime/v1.73.0 (darwin-23.0.0-arm64) go1.21.0 Unknown/0"),
    ).toBeNull();
    expect(editorFromUserAgent("wakatime/v1.73.0 (darwin-23.0.0-arm64) go1.21.0")).toBeNull();
    expect(editorFromUserAgent("nonsense")).toBeNull();
    expect(editorFromUserAgent("")).toBeNull();
  });
});
