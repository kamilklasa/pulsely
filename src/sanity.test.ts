import { describe, expect, it } from "vitest";

// Catches Vitest/tsconfig misconfiguration early — not app logic.
// Real domain tests start landing with the task-transition rule (Ticket 4).
describe("vitest config sanity", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });
});
