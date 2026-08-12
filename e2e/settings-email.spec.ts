import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    "Missing Supabase env vars for the settings email e2e test — copy .env.example to .env.local",
  );
}

const admin = createClient(supabaseUrl!, serviceRoleKey!);

// Same magic-link redemption the board specs use — settings sit behind auth.
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
  return `e2e-settings-${crypto.randomUUID()}@example.com`;
}

test("requesting a new address shows the pending state and keeps the old one", async ({
  page,
  baseURL,
}) => {
  const currentEmail = freshEmail();
  const nextEmail = freshEmail();
  await signInOnBoard(page, baseURL, currentEmail);
  await openSettings(page);

  const field = page.getByLabel("Email address");
  await expect(field).toHaveValue(currentEmail);
  await field.fill(nextEmail);
  await page.getByRole("button", { name: "Save" }).click();

  await expect(page.getByText("Waiting for two confirmations")).toBeVisible();
  await expect(field).toBeDisabled();
  await expect(field).toHaveValue(nextEmail);
  // Both addresses, because the user still has to act on both inboxes — and
  // naming the current one is how the UI admits the change hasn't happened yet.
  const notice = page.getByText(/We sent a link to .* and to /);
  await expect(notice).toContainText(currentEmail);
  await expect(notice).toContainText(nextEmail);

  // The change is pending, not applied — reopening must not claim otherwise.
  await page.keyboard.press("Escape");
  await openSettings(page);
  await expect(page.getByText("Waiting for two confirmations")).toBeVisible();

  // A typo in the pending address must not be a dead end — and unlocking the
  // field must not hide the change that is still outstanding.
  await page.getByRole("button", { name: "Send to a different address" }).click();
  await expect(field).toBeEditable();
  await expect(page.getByText("Waiting for two confirmations")).toBeVisible();
});

test("an address another account owns fails inline, and the field stays editable", async ({
  page,
  baseURL,
}) => {
  const takenEmail = freshEmail();
  const { error } = await admin.auth.admin.createUser({ email: takenEmail, email_confirm: true });
  expect(error).toBeNull();

  await signInOnBoard(page, baseURL, freshEmail());
  await openSettings(page);

  const field = page.getByLabel("Email address");
  await field.fill(takenEmail);
  await page.getByRole("button", { name: "Save" }).click();

  const taken = page.getByText("Another account already uses that address.");
  await expect(taken).toBeVisible();
  await expect(field).toBeEditable();
  await expect(page.getByText("Waiting for two confirmations")).toBeHidden();

  // The rejection was about the address that was submitted — editing it makes
  // the message stale, so it must not sit under the corrected one.
  await field.fill(freshEmail());
  await expect(taken).toBeHidden();
});

test("the Account section no longer advertises itself as unfinished", async ({ page, baseURL }) => {
  await signInOnBoard(page, baseURL, freshEmail());
  await openSettings(page);

  const account = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Account", exact: true }) });
  await expect(account.getByText("Soon")).toHaveCount(0);
});
