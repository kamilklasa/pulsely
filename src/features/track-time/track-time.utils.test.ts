import { describe, expect, it } from "vitest";
import { formatClockTime, formatDuration, formatEntryStart } from "./track-time.utils";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

describe("formatDuration", () => {
  it("keeps seconds visible so a running clock is seen to move", () => {
    expect(formatDuration(0)).toBe("0:00");
    expect(formatDuration(7_000)).toBe("0:07");
    expect(formatDuration(9 * MINUTE + 5_000)).toBe("9:05");
  });

  // The hours segment only appears once there is one — most runs never grow it,
  // and a leading "0:" on every card would be noise.
  it("grows an hours segment only once the run passes an hour", () => {
    expect(formatDuration(59 * MINUTE + 59_000)).toBe("59:59");
    expect(formatDuration(HOUR)).toBe("1:00:00");
    expect(formatDuration(2 * HOUR + 3 * MINUTE + 4_000)).toBe("2:03:04");
  });

  // Sub-second remainders are dropped rather than rounded up: a timer that read
  // 0:01 the instant it was started would be lying about the run.
  it("truncates towards the second that has actually elapsed", () => {
    expect(formatDuration(999)).toBe("0:00");
    expect(formatDuration(1_999)).toBe("0:01");
  });

  // Two entries that disagree about which came first can subtract to a negative;
  // the display shows nothing rather than a "-1:-1".
  it("shows a negative duration as zero", () => {
    expect(formatDuration(-5_000)).toBe("0:00");
  });
});

// The exact rendering is the platform's (12- vs 24-hour, day/month order), so
// what is pinned here is the shape and that the locale is honoured at all —
// asserting ICU's own output would only restate it.
describe("formatEntryStart", () => {
  const iso = "2026-08-12T09:00:00.000Z";

  it("carries the date and the time of day", () => {
    expect(formatEntryStart(iso, "en")).toMatch(/^Aug \d{1,2}, \d{1,2}:\d{2}(\s| )?(AM|PM)$/);
  });

  it("formats in the locale it is given", () => {
    expect(formatEntryStart(iso, "pl")).toMatch(/^\d{1,2} sie, \d{2}:\d{2}$/);
  });
});

describe("formatClockTime", () => {
  const iso = "2026-08-12T09:30:00.000Z";

  // Only the clock: the start it is read next to already carries the date.
  it("drops the date from the stop side of a run", () => {
    expect(formatClockTime(iso, "pl")).toMatch(/^\d{2}:\d{2}$/);
    expect(formatClockTime(iso, "en")).toMatch(/^\d{1,2}:\d{2}(\s| )?(AM|PM)$/);
  });
});
