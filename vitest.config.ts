import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      // Match tsconfig's `@/*` so probes can execute app/lib modules.
      "@/": fileURLToPath(new URL("./", import.meta.url)),
      // `server-only` throws outside a React Server Component graph;
      // tests run in plain node, so alias it to an empty stub.
      "server-only": fileURLToPath(
        new URL("./tests/stubs/server-only.ts", import.meta.url),
      ),
    },
  },
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
