/**
 * The local Supabase stack that BOTH the app-under-test and the E2E seeder
 * talk to. In CI these come from `supabase status` (exported as TEST_SUPABASE_*
 * by ci.yml); locally they fall back to the well-known supabase-demo dev keys,
 * exactly as tests/harness.ts does.
 *
 * IMPORTANT: E2E never runs against the remote project in `.env.local` — the
 * Playwright webServer overrides NEXT_PUBLIC_SUPABASE_* with these values so
 * seeding + sign-in happen entirely on the ephemeral local DB.
 */
export const SUPABASE_URL =
  process.env.TEST_SUPABASE_URL || "http://127.0.0.1:54321";

export const SUPABASE_ANON_KEY =
  process.env.TEST_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

export const SUPABASE_SERVICE_ROLE_KEY =
  process.env.TEST_SUPABASE_SERVICE_ROLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
