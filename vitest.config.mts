import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // `server-only` throws outside a React Server Components bundle.
      "server-only": fileURLToPath(
        new URL("./tests/unit/server-only-stub.ts", import.meta.url),
      ),
    },
  },
  test: {
    environment: "node",
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["tests/unit/**/*.test.ts"],
          exclude: ["tests/unit/db/**"],
        },
      },
      {
        // Needs PostgreSQL: `pnpm db:start` locally, a service container in CI.
        extends: true,
        test: {
          name: "db",
          include: ["tests/unit/db/**/*.test.ts"],
          globalSetup: ["tests/unit/db/global-setup.ts"],
          fileParallelism: false,
        },
      },
    ],
  },
});
