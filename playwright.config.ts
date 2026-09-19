import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: "html",
  use: {
    baseURL: "http://127.0.0.1:4273",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium-desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1_440, height: 900 },
      },
    },
    {
      name: "chromium-mobile",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 360, height: 800 },
      },
    },
  ],
  webServer: {
    command: "pnpm --filter @ritmo/client dev --port 4273",
    env: {
      ...process.env,
      VITE_SUPABASE_ANON_KEY: "playwright-public-anon-key",
      VITE_SUPABASE_URL: "http://127.0.0.1:54321",
    },
    url: "http://127.0.0.1:4273",
    reuseExistingServer: false,
  },
});
