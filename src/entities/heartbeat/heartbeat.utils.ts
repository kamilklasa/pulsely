import type { TimeEntry } from "@/entities/time-entry";

// Seam A: pure functions over a list of entries, no I/O. Attribution is the rule
// the whole phase rests on — get it wrong and hours are filed against the wrong
// task, or silently dropped, with nothing in the UI to show for it.

// A heartbeat belongs to the run whose window contains its timestamp — not to
// "whichever run is open right now". wakatime-cli buffers heartbeats while
// offline and flushes them later, so by the time a batch arrives the run it
// describes has usually already ended.
//
// The window is half-open, `[started_at, stopped_at)`. It has to be: starting a
// timer stops the previous run at exactly the new run's start (see
// applyTimerStart), so adjacent runs share a boundary instant to the
// millisecond. Closing both ends would file that instant against two runs and
// count it twice; the boundary belongs to the run that is beginning.
//
// The open run is the exception, and closed at `now`: nothing starts at `now`,
// so there is no collision to break, and excluding it would drop the heartbeat
// that arrives on this very millisecond. A timestamp past `now` — a machine
// whose clock runs fast — falls outside every window and goes unattributed,
// which is the honest answer rather than a guess.
export function attributeHeartbeat(
  entries: TimeEntry[],
  heartbeatTimeMs: number,
  now: number,
): string | null {
  let match: TimeEntry | null = null;

  for (const entry of entries) {
    const started = Date.parse(entry.started_at);
    const stopped = entry.stopped_at === null ? now : Date.parse(entry.stopped_at);

    const inside =
      entry.stopped_at === null
        ? heartbeatTimeMs >= started && heartbeatTimeMs <= stopped
        : heartbeatTimeMs >= started && heartbeatTimeMs < stopped;
    if (!inside) continue;

    // The timer rules make overlapping runs impossible, so this only breaks a tie
    // that a racing second device could have written. The later run is the one
    // the person is sitting in front of — the same tie-break findRunningEntry
    // makes for two open entries.
    if (match === null || started > Date.parse(match.started_at)) match = entry;
  }

  return match?.id ?? null;
}

// wakatime-cli identifies itself as:
//   wakatime/v1.73.0 (darwin-23.0.0-arm64) go1.21.0 vscode/1.85.0 vscode-wakatime/24.0.0
// The heartbeat body has no editor field at all — the plugin suffix of this
// string is the only place the editor is named.
//
// Read from the last ')' rather than by token index: the parenthesised system
// block is assembled from OS strings that can themselves contain spaces, so
// counting tokens from the left would drift on exactly the platforms we cannot
// test. Everything after it is `<go version> <plugin...>`.
export function editorFromUserAgent(userAgent: string): string | null {
  const systemEnd = userAgent.lastIndexOf(")");
  if (systemEnd === -1) return null;

  const [, plugin] = userAgent
    .slice(systemEnd + 1)
    .trim()
    .split(/\s+/);
  if (!plugin) return null;

  const name = plugin
    .split("/")[0]!
    // Plugins that ship as a single token name themselves `vim-wakatime`,
    // `sublime-wakatime` and so on; the editor is the half in front.
    .replace(/-wakatime$/, "")
    .toLowerCase();

  // What the CLI sends when no plugin identified itself. Recorded as unknown
  // rather than as an editor literally called "unknown".
  if (name === "" || name === "unknown") return null;

  return name;
}
