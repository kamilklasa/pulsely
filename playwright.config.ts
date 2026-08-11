import { defineConfig } from "@playwright/test";
import { loadEnv } from "vite";

// Mirrors vite.config.ts's `test.env` for Vitest — Playwright has no
// equivalent of its own, so without this, e2e specs that need server-only
// vars (e.g. SUPABASE_SERVICE_ROLE_KEY) never see .env.local.
Object.assign(process.env, loadEnv("development", process.cwd(), ""));

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL: "http://localhost:5175",
    trace: "on-first-retry",
  },
  webServer: {
    command: "bun run dev",
    url: "http://localhost:5175",
    reuseExistingServer: !process.env.CI,
  },
});
