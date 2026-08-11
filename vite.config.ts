/// <reference types="vitest/config" />

import path from "node:path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [tailwindcss(), tanstackRouter({ target: "react", autoCodeSplitting: true }), react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  test: {
    exclude: ["**/node_modules/**", "**/e2e/**"],
    // Server-only vars (e.g. SUPABASE_SERVICE_ROLE_KEY) for Seam B integration tests — process.env
    // only, never exposed to the client bundle (that's import.meta.env, gated by envPrefix).
    env: loadEnv(mode, process.cwd(), ""),
  },
  server: {
    // Fixed and strict so Playwright's webServer knows exactly where to
    // find it — other projects on this machine also default to 5173.
    port: 5175,
    strictPort: true,
  },
}));
