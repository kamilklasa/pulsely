import { createClient } from "@supabase/supabase-js";
import { expect, test, type Locator, type Page } from "@playwright/test";

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    "Missing Supabase env vars for the realtime sync e2e test — copy .env.example to .env.local",
  );
}

const TASK_TITLE = "Synced across tabs";

// Same magic-link redemption the other board specs use; the session it leaves in local storage is
// what the second tab picks up, which is exactly the "two tabs, one user" case under test.
async function signInOnBoard(page: Page, baseURL: string | undefined) {
  const admin = createClient(supabaseUrl!, serviceRoleKey!);
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: `e2e-realtime-${crypto.randomUUID()}@example.com`,
    options: { redirectTo: `${baseURL}/board` },
  });
  expect(error).toBeNull();

  await page.goto(data.properties!.action_link);
  await page.waitForURL(/\/board/);
  await expect(page.getByRole("heading", { name: "Backlog" })).toBeVisible();
}

function column(page: Page, name: string): Locator {
  return page.locator("section").filter({ has: page.getByRole("heading", { name, exact: true }) });
}

test("a second open tab follows every change without reloading", async ({ page, baseURL }) => {
  await signInOnBoard(page, baseURL);

  // The observer. It loads once here and is never navigated or reloaded again, so anything that
  // shows up on it afterwards can only have arrived over the realtime channel.
  const observer = await page.context().newPage();
  await observer.goto("/board");
  await expect(observer.getByRole("heading", { name: "Backlog" })).toBeVisible();

  await page.getByRole("button", { name: "Add task" }).first().click();
  await page.getByPlaceholder("Task title…").fill(TASK_TITLE);
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(column(observer, "Backlog").getByRole("button", { name: TASK_TITLE })).toBeVisible();

  await page.getByRole("button", { name: TASK_TITLE }).hover();
  await page.getByRole("button", { name: "Move right" }).click();
  await expect(
    column(observer, "This Week").getByRole("button", { name: TASK_TITLE }),
  ).toBeVisible();
  await expect(column(observer, "Backlog").getByRole("button", { name: TASK_TITLE })).toHaveCount(
    0,
  );

  await page.getByRole("button", { name: TASK_TITLE }).hover();
  await page.getByRole("button", { name: "More actions" }).click();
  await page.getByRole("menuitem", { name: "Delete task" }).click();
  await expect(observer.getByRole("button", { name: TASK_TITLE })).toHaveCount(0);
});

test("a tab never receives another user's tasks", async ({ page, baseURL, browser }) => {
  await signInOnBoard(page, baseURL);

  // A second user in their own context, so nothing is shared but the database.
  const otherContext = await browser.newContext({ baseURL });
  const otherPage = await otherContext.newPage();
  await signInOnBoard(otherPage, baseURL);

  await otherPage.getByRole("button", { name: "Add task" }).first().click();
  await otherPage.getByPlaceholder("Task title…").fill("Someone else's task");
  await otherPage.getByRole("button", { name: "Add", exact: true }).click();
  await expect(otherPage.getByRole("button", { name: "Someone else's task" })).toBeVisible();

  // The first user's own write proves the channel is live and delivering — so the other user's
  // task being absent is a real exclusion, not just a board that never heard anything.
  await page.getByRole("button", { name: "Add task" }).first().click();
  await page.getByPlaceholder("Task title…").fill(TASK_TITLE);
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByRole("button", { name: TASK_TITLE })).toBeVisible();

  await expect(page.getByRole("button", { name: "Someone else's task" })).toHaveCount(0);
  await otherContext.close();
});
