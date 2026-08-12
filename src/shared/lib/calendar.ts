// When a day and a week begin, for everything that reports "today" or "this
// week" — the board's column progress and the time dashboard's totals alike.
// Shared so the two can never disagree about where a week starts.
//
// Local time throughout: the day being asked about is the person's own, and a
// boundary in UTC would cut somebody's evening in half anywhere but Greenwich.

export const DAYS_IN_WEEK = 7;

export function startOfDay(instant: number): number {
  const date = new Date(instant);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

// Days are added through the calendar rather than by adding 24h of
// milliseconds: the day a clock change falls on is 23 or 25 hours long, and the
// boundary has to land on local midnight either way.
export function addDays(instant: number, days: number): number {
  const date = new Date(instant);
  date.setDate(date.getDate() + days);
  return date.getTime();
}

// Monday-first — ISO, and the working week both shipped locales read. A Sunday
// evening belongs to the week that is ending, not to the one about to start.
export function startOfWeek(instant: number): number {
  const dayStart = startOfDay(instant);
  return addDays(dayStart, -((new Date(dayStart).getDay() + 6) % DAYS_IN_WEEK));
}
