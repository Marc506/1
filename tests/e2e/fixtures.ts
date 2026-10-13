import { test as base, type BrowserContext } from "@playwright/test";
import { createSessionToken, SESSION_COOKIE } from "@/lib/auth/session";
import { E2E_SESSION_SECRET } from "./env";

export { expect } from "@playwright/test";

let ipCounter = 0;

export const test = base.extend<{ signIn: () => Promise<void> }>({
  // Login is rate-limited per client IP. Give every test its own address so
  // tests don't share a budget (the dev server trusts X-Forwarded-For).
  context: async ({ context }, use, testInfo) => {
    ipCounter += 1;
    await context.setExtraHTTPHeaders({
      "x-forwarded-for": `10.${testInfo.parallelIndex}.${Math.floor(ipCounter / 250)}.${ipCounter % 250}`,
    });
    await use(context);
  },
  // Sets a valid session cookie without going through the login form.
  signIn: async ({ context, baseURL }, use) => {
    await use(() => addSessionCookie(context, baseURL!));
  },
});

async function addSessionCookie(context: BrowserContext, baseURL: string) {
  await context.addCookies([
    {
      name: SESSION_COOKIE,
      value: await createSessionToken(E2E_SESSION_SECRET),
      url: baseURL,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}
