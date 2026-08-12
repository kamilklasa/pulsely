import { createClient } from "@supabase/supabase-js";
import { expect, test, type Locator, type Page } from "@playwright/test";

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    "Missing Supabase env vars for the transition e2e test — copy .env.example to .env.local",
  );
}

const TASK_TITLE = "Transition rule";

// Same magic-link redemption the other board specs use: the board is behind
// auth, and there is no seam to reach a task card without signing in.
async function signInOnBoard(page: Page, baseURL: string | undefined) {
  const admin = createClient(supabaseUrl!, serviceRoleKey!);
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: `e2e-transition-${crypto.randomUUID()}@example.com`,
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

// The move controls live in the cluster that only appears on card hover.
async function moveRight(page: Page, title: string) {
  await page.getByRole("button", { name: title }).hover();
  await page.getByRole("button", { name: "Move right" }).click();
}

test("a task in Backlog can't be ticked straight to Done", async ({ page, baseURL }) => {
  await signInOnBoard(page, baseURL);
  await addTask(page, TASK_TITLE);

  const toggle = page.getByRole("button", {
    name: "Move it out of Backlog first — a task can't go straight to Done",
  });
  await expect(toggle).toHaveAttribute("aria-disabled", "true");

  // `force` because aria-disabled already makes Playwright refuse the click —
  // this asserts the harder thing: the handler itself does nothing either.
  await toggle.click({ force: true });

  await expect(column(page, "Backlog").getByRole("button", { name: TASK_TITLE })).toBeVisible();
  await expect(column(page, "Done").getByRole("button", { name: TASK_TITLE })).toHaveCount(0);
});

test("a task that went through the board can be moved backward out of Done", async ({
  page,
  baseURL,
}) => {
  await signInOnBoard(page, baseURL);
  await addTask(page, TASK_TITLE);

  await moveRight(page, TASK_TITLE);
  await expect(column(page, "This Week").getByRole("button", { name: TASK_TITLE })).toBeVisible();
  await moveRight(page, TASK_TITLE);
  await expect(column(page, "Today").getByRole("button", { name: TASK_TITLE })).toBeVisible();

  await page.getByRole("button", { name: "Mark as done" }).click();
  await expect(column(page, "Done").getByRole("button", { name: TASK_TITLE })).toBeVisible();

  await page.getByRole("button", { name: "Move back to Today" }).click();
  await expect(column(page, "Today").getByRole("button", { name: TASK_TITLE })).toBeVisible();
});
