import { existsSync } from "node:fs";
import { defineConfig, devices, webkit } from "@playwright/test";
import {
  E2E_DATABASE_URL,
  E2E_PASSWORD,
  E2E_SESSION_SECRET,
  MOCK_GOOGLE_KEY,
  MOCK_GOOGLE_PORT,
} from "./tests/e2e/env";

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
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
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
  // Never reuse an existing server: a stray one would run with other settings.
  webServer: [
    {
      command: "tsx tests/e2e/mock-google.ts",
      url: `http://localhost:${MOCK_GOOGLE_PORT}/health`,
      reuseExistingServer: false,
      stdout: "ignore",
      stderr: "pipe",
    },
    {
      command: `pnpm build && pnpm start -p ${PORT}`,
      url: baseURL,
      reuseExistingServer: false,
      env: {
        APP_PASSWORD: E2E_PASSWORD,
        SESSION_SECRET: E2E_SESSION_SECRET,
        DATABASE_URL: E2E_DATABASE_URL,
        GEOCODING_PROVIDER: "google",
        GOOGLE_MAPS_API_KEY: MOCK_GOOGLE_KEY,
        GOOGLE_PLACES_ENDPOINT: `http://localhost:${MOCK_GOOGLE_PORT}/v1/places:searchText`,
      },
      timeout: 240_000,
      stdout: "ignore",
      stderr: "pipe",
    },
  ],
});
