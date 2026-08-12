import { createClient } from "@supabase/supabase-js";
import { expect, test, type Locator, type Page } from "@playwright/test";

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    "Missing Supabase env vars for the time tracking e2e test — copy .env.example to .env.local",
  );
}

const TASK_TITLE = "Golden path";

// Same magic-link redemption the other board specs use: the board is behind
// auth, and there is no seam to reach a task card without signing in.
async function signInOnBoard(page: Page, baseURL: string | undefined) {
  const admin = createClient(supabaseUrl!, serviceRoleKey!);
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: `e2e-time-${crypto.randomUUID()}@example.com`,
    options: { redirectTo: `${baseURL}/board` },
  });
  expect(error).toBeNull();

  await page.goto(data.properties!.action_link);
  await page.waitForURL(/\/board/);
  await expect(page.getByRole("heading", { name: "Backlog" })).toBeVisible();
}

async function addTask(page: Page, title: string) {
  await page.getByRole("button", { name: "Add task" }).first().click();
  await page.getByPlaceholder("Task title…").fill(title);
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByRole("button", { name: title })).toBeVisible();
}

// The columns carry no accessible name of their own — their heading is what
// identifies them.
function column(page: Page, name: string): Locator {
  return page.locator("section").filter({ has: page.getByRole("heading", { name, exact: true }) });
}

// A displayed m:ss as a number, so a ticking clock can be compared against
// itself without depending on where the second boundary happens to fall.
async function seconds(duration: Locator): Promise<number> {
  const [minutes, secs] = ((await duration.textContent()) ?? "").split(":");
  return Number(minutes) * 60 + Number(secs);
}

// The move controls live in the cluster that only appears on card hover.
async function moveRight(page: Page, title: string) {
  await page.getByRole("button", { name: title }).hover();
  await page.getByRole("button", { name: "Move right" }).click();
}

// The one end-to-end pass over Phase 1: everything a person does on their first
// session, in the order they do it, through the real UI against a real
// database. The narrower rules (transitions, RLS, the timer's own arithmetic)
// have their own specs — this is the walk that proves they add up to a product.
test("golden path: sign in, plan a task, track time on it, and review the run", async ({
  page,
  baseURL,
}) => {
  await signInOnBoard(page, baseURL);
  await addTask(page, TASK_TITLE);

  await moveRight(page, TASK_TITLE);
  await expect(column(page, "This Week").getByRole("button", { name: TASK_TITLE })).toBeVisible();
  await moveRight(page, TASK_TITLE);
  await expect(column(page, "Today").getByRole("button", { name: TASK_TITLE })).toBeVisible();

  const card = column(page, "Today").getByRole("listitem").filter({ hasText: TASK_TITLE });
  const elapsed = card.getByLabel(/Time tracked/);
  await expect(elapsed).toHaveText("0:00");

  // A real run, measured by the same wall clock the user watches: the assertion
  // waits for the ticking display to pass a full second rather than sleeping.
  await card.getByRole("button", { name: "Start" }).click();
  await expect(elapsed).toHaveText(/^0:0[1-9]$/);
  await card.getByRole("button", { name: "Stop" }).click();

  // The button flipping back is what says the stop has landed. Everything below
  // is keyed off the duration text, so it is read only once the display has
  // settled on the stored value — a plain textContent() here would race the
  // still-ticking one and take a number that changes a frame later.
  await expect(card.getByRole("button", { name: "Start" })).toBeVisible();
  await expect(elapsed).toHaveText(/^0:0[1-9]$/);
  const logged = (await elapsed.textContent()) ?? "";

  // Finishing the task carries its tracked time into the last column with it.
  await card.getByRole("button", { name: "Mark as done" }).click();
  const doneCard = column(page, "Done").getByRole("listitem").filter({ hasText: TASK_TITLE });
  await expect(doneCard.getByLabel(/Time tracked/)).toHaveText(logged);

  await doneCard.getByRole("button", { name: TASK_TITLE }).click();
  const details = page.getByRole("dialog");
  await expect(details.getByRole("heading", { name: "Timeline" })).toBeVisible();
  await expect(details.getByText(`Total ${logged}`)).toBeVisible();

  // The run itself, listed with the duration the card totalled.
  const entry = details.getByRole("listitem").filter({ hasText: logged });
  await expect(entry).toHaveCount(1);

  // Deleting the mistaken run takes its time off the task: the list empties and
  // the total drops back to zero.
  await entry.getByRole("button", { name: `Delete the ${logged} entry` }).click();
  await expect(details.getByText("No time logged on this task yet.")).toBeVisible();
  await expect(details.getByText("Total 0:00")).toBeVisible();

  // And the deletion is the database's now, not just this tab's cache.
  await page.reload();
  await expect(page.getByLabel(/Time tracked/)).toHaveText("0:00");
});

// The run that hasn't ended is listed too, counting up — a timeline that only
// showed finished runs would look empty for as long as you were working.
test("the timeline lists the open run while the timer is still going", async ({
  page,
  baseURL,
}) => {
  await signInOnBoard(page, baseURL);
  await addTask(page, TASK_TITLE);

  const card = page.getByRole("listitem").filter({ hasText: TASK_TITLE });
  await card.getByRole("button", { name: "Start" }).click();
  await expect(card.getByLabel(/Time tracked/)).toHaveText(/^0:0[1-9]$/);

  await card.getByRole("button", { name: TASK_TITLE }).click();
  const details = page.getByRole("dialog");
  const openRun = details.getByRole("listitem").filter({ hasText: "running" });
  await expect(openRun).toHaveCount(1);

  // Still moving with the dialog open: the row is measured against the clock,
  // not frozen at whatever it read when it mounted. Compared as seconds rather
  // than as text — a negated toHaveText would also pass on a row that vanished.
  const duration = openRun.getByText(/^\d+:\d\d$/);
  await expect(duration).toBeVisible();
  const before = await seconds(duration);
  await expect.poll(() => seconds(duration)).toBeGreaterThan(before);
});
