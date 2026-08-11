import { expect, test } from "@playwright/test";

test("root redirects to sign-in", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Sign in to Pulsely" })).toBeVisible();
});
