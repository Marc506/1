import { existsSync } from "node:fs";
import { defineConfig, devices, webkit } from "@playwright/test";
import { E2E_PASSWORD, E2E_SESSION_SECRET } from "./tests/e2e/env";

const PORT = Number(process.env.E2E_PORT ?? 3100);
const baseURL = `http://localhost:${PORT}`;

// WebKit is not preinstalled in the cloud dev container. Fall back to an
// iPhone viewport on Chromium there; CI installs WebKit and runs the real one.
const hasWebKit = existsSync(webkit.executablePath());
if (!hasWebKit && !process.env.CI && !process.env.TEST_WORKER_INDEX) {
  console.warn(
    "[e2e] WebKit not installed: running iPhone viewport on Chromium (未在 WebKit 验证).",
  );
}

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  projects: [
    hasWebKit
      ? { name: "iphone-webkit", use: { ...devices["iPhone 15"] } }
      : {
          name: "iphone-chromium",
          use: { ...devices["iPhone 15"], browserName: "chromium" },
        },
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: `pnpm build && pnpm start -p ${PORT}`,
    url: baseURL,
    // Never reuse: a stray server would run with different secrets.
    reuseExistingServer: false,
    env: { APP_PASSWORD: E2E_PASSWORD, SESSION_SECRET: E2E_SESSION_SECRET },
    timeout: 240_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
