import { defineConfig, devices } from "@playwright/test";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./e2e/helpers/env";

/**
 * E2E config for the auth/onboarding screens. The webServer boots `next dev`
 * on a dedicated port with NEXT_PUBLIC_SUPABASE_* pinned to the LOCAL stack
 * (never the remote project in .env.local — Next only fills env vars that are
 * unset, so these overrides win). Tests seed users via the service role
 * against that same local DB.
 */
const PORT = 3100;
const BASE_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  // One shared local DB → run serially to keep seeding deterministic.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [["list"], ["html", { open: "never" }]]
    : [["list"]],
  timeout: 30_000,
  expect: { timeout: 8_000 },
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // Production build + serve into an isolated dist dir, so it coexists with a
    // running `next dev` and bakes the LOCAL Supabase URL into the client bundle
    // (NEXT_PUBLIC_* are inlined at build time). A leftover E2E server on this
    // port is safe to reuse locally; CI always builds fresh.
    command: `npm run build && npm run start -- -p ${PORT}`,
    url: BASE_URL,
    timeout: 240_000,
    reuseExistingServer: !process.env.CI,
    env: {
      NEXT_DIST_DIR: ".next-e2e",
      NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: SUPABASE_ANON_KEY,
      NEXT_PUBLIC_SITE_URL: BASE_URL,
    },
  },
});
