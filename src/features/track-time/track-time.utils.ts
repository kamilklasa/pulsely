// Seconds matter while a task is running (the number has to visibly move), so
// the short form keeps them and only grows an hours segment once there is one.
export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const hours = Math.floor(totalSeconds / 3600);
  const pad = (value: number) => String(value).padStart(2, "0");

  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
}

// Durations are formatDuration's job; these two are the "when" on either side
// of a logged run. Left to the locale's own conventions (12- vs 24-hour,
// day/month order) rather than a hand-rolled format.
export function formatEntryStart(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

// The dashboard's column labels. The weekday alone, abbreviated by the locale:
// under a chart of one week the date is noise, and Monday is Monday either way.
export function formatWeekday(instant: number, locale: string): string {
  return new Intl.DateTimeFormat(locale, { weekday: "short" }).format(new Date(instant));
}

// The stop side of the range only needs the clock: it is read next to a start
// that already carries the date, and a run that spans midnight is rare enough
// not to be worth the extra noise on every other row.
export function formatClockTime(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }).format(
    new Date(iso),
  );
}
