import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    "Missing Supabase env vars for the board i18n e2e test — copy .env.example to .env.local",
  );
}

// Redeems a real magic link (via the admin API, same approach as the Seam B
// integration test) to land on an authenticated /board with no UI switcher
// on that screen — the persisted locale from #12 is what drives the copy.
test("switching language on sign-in shows translated board copy after auth", async ({
  page,
  baseURL,
}) => {
  const email = `e2e-board-${crypto.randomUUID()}@example.com`;
  const admin = createClient(supabaseUrl!, serviceRoleKey!);

  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo: `${baseURL}/board` },
  });
  expect(error).toBeNull();
  const actionLink = data.properties?.action_link;
  expect(actionLink).toBeTruthy();

  await page.goto("/");
  await page.getByRole("combobox", { name: "Language" }).click();
  await page.getByRole("option", { name: "Polski" }).click();
  await expect(page.getByRole("heading", { name: "Zaloguj się do Pulsely" })).toBeVisible();

  await page.goto(actionLink!);

  await expect(page.getByRole("heading", { name: "Tablica" })).toBeVisible();
  await expect(page.getByText(`Zalogowano jako ${email}`)).toBeVisible();
  await expect(page.getByRole("button", { name: "Wyloguj" })).toBeVisible();
});
