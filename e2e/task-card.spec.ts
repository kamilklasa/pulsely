import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    "Missing Supabase env vars for the task card e2e test — copy .env.example to .env.local",
  );
}

const TASK_TITLE = "Card menu regression";

// Same magic-link redemption the board i18n test uses: the board is behind
// auth, and there is no seam to reach a task card without signing in.
async function signInOnBoard(page: Page, baseURL: string | undefined) {
  const admin = createClient(supabaseUrl!, serviceRoleKey!);
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: `e2e-card-${crypto.randomUUID()}@example.com`,
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

// Regression: the card opens its details on click, and the overflow menu is
// rendered in a portal. Portalled content still bubbles through the React
// tree, so "Edit task" reached the card's own click handler and opened the
// details dialog on top of the edit dialog — two modals from one click.
test("opening a task's edit dialog from the overflow menu opens exactly one dialog", async ({
  page,
  baseURL,
}) => {
  await signInOnBoard(page, baseURL);
  await addTask(page, TASK_TITLE);

  await page.getByRole("button", { name: TASK_TITLE }).hover();
  await page.getByRole("button", { name: "More actions" }).click();
  await page.getByRole("menuitem", { name: "Edit task" }).click();

  await expect(page.getByRole("dialog")).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "Edit task" })).toBeVisible();
});

// The other half of the same handler: a plain click on the card body is still
// supposed to open the details dialog.
test("clicking a task card opens its details", async ({ page, baseURL }) => {
  await signInOnBoard(page, baseURL);
  await addTask(page, TASK_TITLE);

  await page.getByRole("button", { name: TASK_TITLE }).click();

  await expect(page.getByRole("dialog")).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "Timeline" })).toBeVisible();
});
