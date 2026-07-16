import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // Tests share a single local Supabase DB; run serially to avoid
    // trigger-driven state contention (e.g., published_reviews_total).
    fileParallelism: false,
    sequence: { concurrent: false },
    globals: false,
  },
});
