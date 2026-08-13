import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    "Missing Supabase env vars for the settings integrations e2e test — copy .env.example to .env.local",
  );
}

const admin = createClient(supabaseUrl!, serviceRoleKey!);

// Same magic-link redemption the other settings spec uses — settings sit behind auth.
async function signInOnBoard(page: Page, baseURL: string | undefined, email: string) {
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo: `${baseURL}/board` },
  });
  expect(error).toBeNull();

  await page.goto(data.properties!.action_link);
  await page.waitForURL(/\/board/);
  await expect(page.getByRole("heading", { name: "Backlog" })).toBeVisible();
}

async function openSettings(page: Page) {
  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
}

function freshEmail() {
  return `e2e-integrations-${crypto.randomUUID()}@example.com`;
}

// The click itself leaves for Google's consent screen, which this suite can't drive.
// What it can hold onto is everything the user sees before that: an account with no
// Google says so, and the control is live rather than an advertisement.
test("a magic-link account is offered a live Connect control", async ({ page, baseURL }) => {
  await signInOnBoard(page, baseURL, freshEmail());
  await openSettings(page);

  const integrations = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Integrations", exact: true }) });

  await expect(integrations.getByText("Soon")).toHaveCount(0);
  await expect(integrations.getByText("Not connected")).toBeVisible();
  await expect(integrations.getByRole("button", { name: "Connect" })).toBeEnabled();
});
