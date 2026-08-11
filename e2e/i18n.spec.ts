import { expect, test } from "@playwright/test";

test("sign-in page shows English copy by default", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Sign in to Pulsely" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Send magic link" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
});

test("switching language shows Polish copy immediately, without a reload", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Sign in to Pulsely" })).toBeVisible();

  await page.getByRole("switch", { name: "Language" }).click();

  await expect(page.getByRole("heading", { name: "Zaloguj się do Pulsely" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Wyślij magiczny link" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Kontynuuj przez Google" })).toBeVisible();
});

test("reloading the page preserves the chosen language", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("switch", { name: "Language" }).click();
  await expect(page.getByRole("heading", { name: "Zaloguj się do Pulsely" })).toBeVisible();

  await page.reload();

  await expect(page.getByRole("heading", { name: "Zaloguj się do Pulsely" })).toBeVisible();
});
