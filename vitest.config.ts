import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Vitest runs two kinds of tests in a Node environment:
 *  - pure unit tests (e.g. the scoring engine) that need no services, and
 *  - integration tests under tests/integration that talk to the local Supabase
 *    stack (RLS, deadline trigger). The latter read connection details from
 *    .env.local via tests/setup.ts and skip themselves when those are absent.
 */
export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    // Integration tests share one Postgres instance; run them serially to keep
    // assertions about row visibility deterministic.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // The real `server-only` package throws on import in plain Node; stub it so
      // tests can import server modules (env.server, service client, dispatcher).
      "server-only": fileURLToPath(new URL("./tests/stubs/server-only.ts", import.meta.url)),
    },
  },
});
