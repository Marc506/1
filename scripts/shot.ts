/**
 * Screenshot a page in an iPhone 15 viewport so it can be reviewed outside
 * the container.
 *
 *   pnpm shot /                 -> artifacts/home-iphone-<engine>.png
 *   pnpm shot /login --lang=en  -> force the UI language
 *   pnpm shot / --desktop       -> desktop viewport instead
 *   pnpm shot / --full          -> whole page instead of one screen (fixed
 *                                  bars then appear mid-page)
 *   pnpm shot /c/<id>/add --type="Katz's"  -> type into the focused field
 *   ... --click="Button name"   -> then click that button
 *
 * Uses SHOT_BASE_URL if set; otherwise starts `next start` on port 3200 from
 * the existing build (run `pnpm build` or `pnpm e2e` first) and stops it after.
 * If APP_PASSWORD is set and the page redirects to /login, it logs in first.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import {
  chromium,
  devices,
  webkit,
  type BrowserContextOptions,
} from "@playwright/test";

const args = process.argv.slice(2);
const target = args.find((a) => !a.startsWith("--")) ?? "/";
const desktop = args.includes("--desktop");
const fullPage = args.includes("--full");
const lang = args.find((a) => a.startsWith("--lang="))?.slice("--lang=".length);
const clickName = args
  .find((a) => a.startsWith("--click="))
  ?.slice("--click=".length);
const typed = args
  .find((a) => a.startsWith("--type="))
  ?.slice("--type=".length);

const PORT = 3200;
const MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";
const baseURL = process.env.SHOT_BASE_URL ?? `http://localhost:${PORT}`;

async function isUp(url: string): Promise<boolean> {
  try {
    await fetch(url, { redirect: "manual" });
    return true;
  } catch {
    return false;
  }
}

async function startServer(): Promise<ChildProcess> {
  if (!existsSync(".next/BUILD_ID")) {
    throw new Error("No production build found. Run `pnpm build` first.");
  }
  if (await isUp(baseURL)) {
    throw new Error(`Port ${PORT} is already in use; stop that server first.`);
  }
  // Run the Next binary directly so killing the child stops the server.
  const child = spawn("node_modules/.bin/next", ["start", "-p", String(PORT)], {
    stdio: "ignore",
  });
  for (let i = 0; i < 60; i++) {
    if (await isUp(baseURL)) return child;
    await new Promise((r) => setTimeout(r, 500));
  }
  await stopServer(child);
  throw new Error(`Server did not start on ${baseURL}`);
}

async function stopServer(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null) return;
  const exited = new Promise((r) => child.once("exit", r));
  child.kill("SIGTERM");
  await Promise.race([exited, new Promise((r) => setTimeout(r, 5_000))]);
  if (child.exitCode === null) child.kill("SIGKILL");
}

function slug(p: string): string {
  const s = p.replace(/^\/+|\/+$/g, "").replace(/[^a-zA-Z0-9]+/g, "-");
  return s || "home";
}

async function main() {
  const server = process.env.SHOT_BASE_URL ? undefined : await startServer();
  const useWebKit = !desktop && existsSync(webkit.executablePath());
  const browserType = useWebKit ? webkit : chromium;
  const engine = useWebKit ? "webkit" : "chromium";

  const contextOptions: BrowserContextOptions = desktop
    ? { ...devices["Desktop Chrome"] }
    : { ...devices["iPhone 15"] };
  delete (contextOptions as { defaultBrowserType?: string }).defaultBrowserType;
  if (lang) contextOptions.locale = lang;

  const browser = await browserType.launch();
  try {
    const context = await browser.newContext({ ...contextOptions, baseURL });
    const page = await context.newPage();
    if (!(await isUp(MAP_STYLE_URL))) {
      // The cloud container cannot reach the tile server; use a plain
      // background so pins and layout still show.
      console.log("note: map tiles unreachable, using a blank map style");
      await page.route("https://tiles.openfreemap.org/**", (route) =>
        route.fulfill({
          json: {
            version: 8,
            sources: {},
            layers: [
              {
                id: "bg",
                type: "background",
                paint: { "background-color": "#e9eee9" },
              },
            ],
          },
        }),
      );
    }
    await page.goto(target, { waitUntil: "networkidle" });

    const password = process.env.APP_PASSWORD;
    if (password && new URL(page.url()).pathname === "/login") {
      await page.locator('input[type="password"]').fill(password);
      await page.locator('button[type="submit"]').click();
      await page.waitForURL((url) => url.pathname !== "/login");
      await page.goto(target, { waitUntil: "networkidle" });
    }

    if (typed) {
      await page.keyboard.type(typed);
      // Debounce plus the search round trip.
      await page.waitForTimeout(1_500);
      await page.waitForLoadState("networkidle");
    }

    if (clickName) {
      await page.getByRole("button", { name: clickName }).click();
      await page.waitForTimeout(1_000);
    }

    mkdirSync("artifacts", { recursive: true });
    const file = path.join(
      "artifacts",
      `${slug(target)}${typed ? "-typed" : ""}${clickName ? "-clicked" : ""}-${desktop ? "desktop" : "iphone"}-${engine}${lang ? `-${lang}` : ""}.png`,
    );
    await page.screenshot({ path: file, fullPage });
    console.log(file);
    if (!useWebKit && !desktop) {
      console.log("note: iPhone viewport on Chromium (未在 WebKit 验证)");
    }
  } finally {
    await browser.close();
    if (server) await stopServer(server);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
