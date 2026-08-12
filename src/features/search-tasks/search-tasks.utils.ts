import type { Task } from "@/entities/task";

const MAX_RESULTS = 8;

// Diacritics must not stand between a query and its task: typing "zadanie"
// has to find "Żądanie zwrotu". NFD decomposition strips the Polish accents,
// except "ł", which is its own codepoint and never decomposes — hence the
// explicit swap. Both replacements are 1:1 in length, which is what lets
// `matchRange` map an offset in the folded string back onto the original.
export function fold(value: string): string {
  return value
    .toLowerCase()
    .replaceAll("ł", "l")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

// Where the query landed in `text`, in the original string's coordinates, or
// null when it isn't there at all.
export function matchRange(text: string, query: string): [start: number, end: number] | null {
  const start = fold(text).indexOf(fold(query));
  if (start === -1) return null;
  return [start, Math.min(start + query.length, text.length)];
}

// Title beats description, and a title the query *starts* is the strongest
// signal of all — typing "rap" should surface "Raport tygodniowy" above a task
// that merely mentions raporty three lines into its description.
function score(task: Task, needle: string): number {
  const title = fold(task.title);
  if (title.startsWith(needle)) return 3;
  if (title.includes(needle)) return 2;
  if (fold(task.description ?? "").includes(needle)) return 1;
  return 0;
}

export function searchTasks(tasks: Task[], query: string): Task[] {
  const needle = fold(query.trim());

  // Nothing typed yet: the tasks touched most recently are the likeliest
  // target, so the palette opens on something useful rather than blank.
  if (!needle) {
    return [...tasks]
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
      .slice(0, MAX_RESULTS);
  }

  return tasks
    .map((task) => ({ task, rank: score(task, needle) }))
    .filter((match) => match.rank > 0)
    .sort((a, b) => b.rank - a.rank || a.task.title.localeCompare(b.task.title))
    .slice(0, MAX_RESULTS)
    .map((match) => match.task);
}
