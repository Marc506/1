import { randomBytes, randomUUID } from "node:crypto";
import {
  expect,
  test as base,
  type BrowserContext,
  type Page,
} from "@playwright/test";
import { createSessionToken, SESSION_COOKIE } from "@/lib/auth/session";
import { E2E_SESSION_SECRET } from "./env";

export { expect } from "@playwright/test";

type Fixtures = {
  /**
   * Signs in without the login form. Each test gets its own owner id, so
   * tests running in parallel against one database never see each other's
   * data (every query filters by owner_id).
   */
  signIn: (ownerId?: string) => Promise<string>;
};

export const test = base.extend<Fixtures>({
  // Login is rate-limited per client IP, and the local server trusts
  // X-Forwarded-For. Give every test a random address so tests never share a
  // budget. (A per-worker counter is not enough: each project starts fresh
  // workers, so counters restart and addresses repeat.)
  context: async ({ context }, use) => {
    const [a, b, c] = randomBytes(3);
    await context.setExtraHTTPHeaders({
      "x-forwarded-for": `10.${a}.${b}.${c}`,
    });
    await use(context);
  },
  signIn: async ({ context, baseURL }, use) => {
    await use(async (ownerId = `e2e-${randomUUID()}`) => {
      await addSessionCookie(context, baseURL!, ownerId);
      return ownerId;
    });
  },
});

/**
 * Phone-first guard: nothing may be wider than the viewport. On iOS an
 * overflowing element zooms the page out and misaligns fixed bars.
 */
export async function expectNoHorizontalOverflow(page: Page) {
  const viewport = page.viewportSize()!.width;
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(width, "page is wider than the viewport").toBeLessThanOrEqual(
    viewport,
  );
}

export async function addSessionCookie(
  context: BrowserContext,
  baseURL: string,
  ownerId: string,
) {
  await context.addCookies([
    {
      name: SESSION_COOKIE,
      value: await createSessionToken(E2E_SESSION_SECRET, ownerId),
      url: baseURL,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}
