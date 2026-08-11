import { expect, test } from "@playwright/test";

test("loads the placeholder page", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Pulsely")).toBeVisible();
});
