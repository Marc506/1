import { randomBytes } from "node:crypto";
import { test as base, type BrowserContext } from "@playwright/test";
import { createSessionToken, SESSION_COOKIE } from "@/lib/auth/session";
import { E2E_SESSION_SECRET } from "./env";

export { expect } from "@playwright/test";

export const test = base.extend<{ signIn: () => Promise<void> }>({
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
