import { expect, test } from "./fixtures";
import { E2E_PASSWORD } from "./env";

test.use({ locale: "en-US" });

test("signs in with the password and signs out", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);

  const password = page.getByLabel("Password");
  await expect(password).toBeFocused();

  await password.fill("not-the-password");
  await page.getByRole("button", { name: "Enter" }).click();
  await expect(page.getByText("Wrong password. Try again.")).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);

  await password.fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Enter" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "PlaceBook" })).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
});

test("returns to the requested page after signing in", async ({ page }) => {
  await page.goto("/settings?tab=general");
  await expect(page).toHaveURL(/\/login\?next=%2Fsettings%3Ftab%3Dgeneral$/);
  await page.getByLabel("Password").fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Enter" }).click();
  await expect(page).toHaveURL(/\/settings\?tab=general$/);
});

test("rejects API calls without a session", async ({ request }) => {
  const res = await request.get("/api/places");
  expect(res.status()).toBe(401);
  expect(await res.json()).toEqual({ error: "unauthorized" });
});

test("ignores a forged session cookie", async ({ context, page, baseURL }) => {
  await context.addCookies([
    { name: "pb_session", value: "forged.token.value", url: baseURL! },
  ]);
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
});

test("rate-limits repeated attempts", async ({ page }) => {
  await page.goto("/login");
  const password = page.getByLabel("Password");
  const submit = page.getByRole("button", { name: "Enter" });
  for (let i = 0; i < 5; i++) {
    await password.fill(`wrong-${i}`);
    await submit.click();
    await expect(page.getByText("Wrong password. Try again.")).toBeVisible();
    await expect(submit).toBeEnabled();
  }
  await password.fill(E2E_PASSWORD);
  await submit.click();
  await expect(
    page.getByText("Too many attempts. Wait a minute and try again."),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
});

test.describe("in Chinese", () => {
  test.use({ locale: "zh-CN" });

  test("shows the login page in Chinese", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
    await expect(page.getByLabel("密码")).toBeVisible();
    await expect(page.getByRole("button", { name: "进入" })).toBeVisible();
  });
});
