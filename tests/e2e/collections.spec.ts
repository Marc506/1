import { addSessionCookie, expect, test } from "./fixtures";

test.use({ locale: "en-US" });

test.beforeEach(async ({ signIn }) => {
  await signIn();
});

test("creates a collection with a city and lists it", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("No collections yet")).toBeVisible();

  await page.getByRole("link", { name: "New collection" }).click();
  await expect(page).toHaveURL(/\/c\/new$/);
  await page.getByLabel("Name").fill("NYC spring break");
  await page.getByLabel("City (optional)").fill("New York");
  await page.getByLabel("Cover emoji (optional)").fill("🗽");
  await page.getByRole("button", { name: "Create" }).click();

  await expect(page).toHaveURL(/\/c\/[0-9a-f-]{36}$/);
  await expect(
    page.getByRole("heading", { name: "NYC spring break" }),
  ).toBeVisible();
  await expect(page.locator("header p")).toHaveText("New York · 0 places");
  // The mock Google API located the city, so there is no warning.
  await expect(page.getByRole("status")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "No places yet" }),
  ).toBeVisible();

  await page.getByRole("link", { name: "Collections" }).click();
  const card = page.getByRole("link", { name: /NYC spring break/ });
  await expect(card).toContainText("New York · 0 places");
  await expect(card).toContainText("🗽");
});

test("requires a name and keeps what was typed", async ({ page }) => {
  await page.goto("/c/new");
  await page.getByLabel("City (optional)").fill("New York");
  await page.getByRole("button", { name: "Create" }).click();

  await expect(page.getByText("Enter a name.")).toBeVisible();
  await expect(page.getByLabel("Name")).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByLabel("City (optional)")).toHaveValue("New York");
  await expect(page).toHaveURL(/\/c\/new$/);
});

test("warns when the city cannot be located", async ({ page }) => {
  await page.goto("/c/new");
  await page.getByLabel("Name").fill("Somewhere");
  await page.getByLabel("City (optional)").fill("Nowhereville Zzz");
  await page.getByRole("button", { name: "Create" }).click();

  await expect(page.getByRole("status")).toContainText(
    "Couldn't locate “Nowhereville Zzz”",
  );

  // Fixing the city in Edit locates it and clears the warning.
  await page.getByRole("link", { name: "Edit" }).click();
  await page.getByLabel("City (optional)").fill("New York");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.locator("header p")).toContainText("New York");
  await expect(page.getByRole("status")).toHaveCount(0);
});

test("edits, archives and restores a collection", async ({ page }) => {
  await page.goto("/c/new");
  await page.getByLabel("Name").fill("Tokyo eats");
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page.getByRole("heading", { name: "Tokyo eats" })).toBeVisible();

  await page.getByRole("link", { name: "Edit" }).click();
  await expect(page.getByLabel("Name")).toHaveValue("Tokyo eats");
  await page.getByLabel("Name").fill("Tokyo 2027");
  await page.getByLabel("Cover emoji (optional)").fill("🍣");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("heading", { name: "Tokyo 2027" })).toBeVisible();

  await page.getByRole("link", { name: "Edit" }).click();
  await page.getByRole("button", { name: "Archive this collection" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText("No collections yet")).toBeVisible();

  await page.getByRole("link", { name: "Archived (1)" }).click();
  await expect(
    page.getByRole("heading", { name: "Archived collections" }),
  ).toBeVisible();
  await page.getByRole("link", { name: /Tokyo 2027/ }).click();
  await expect(page.locator("header p")).toContainText("Archived");

  await page.getByRole("link", { name: "Edit" }).click();
  await page.getByRole("button", { name: "Unarchive" }).click();
  await page.getByRole("link", { name: "Collections" }).click();
  await expect(page.getByRole("link", { name: /Tokyo 2027/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Archived \(/ })).toHaveCount(0);
});

test("hides another owner's collection", async ({ page, browser, baseURL }) => {
  await page.goto("/c/new");
  await page.getByLabel("Name").fill("Private list");
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page).toHaveURL(/\/c\/[0-9a-f-]{36}$/);
  const url = page.url();

  const other = await browser.newContext();
  await addSessionCookie(other, baseURL!, "e2e-someone-else");
  const otherPage = await other.newPage();
  const res = await otherPage.goto(url);
  expect(res?.status()).toBe(404);
  const editRes = await otherPage.goto(`${url}/edit`);
  expect(editRes?.status()).toBe(404);
  await other.close();
});

test("returns 404 for a malformed collection id", async ({ page }) => {
  const res = await page.goto("/c/not-a-uuid");
  expect(res?.status()).toBe(404);
});

test.describe("in Chinese", () => {
  test.use({ locale: "zh-CN" });

  test("creates a collection with a Chinese city name", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "新建集合" }).click();
    await page.getByLabel("名称").fill("东京 2027");
    await page.getByLabel("城市（可选）").fill("东京");
    await page.getByRole("button", { name: "创建" }).click();
    await expect(
      page.getByRole("heading", { name: "东京 2027" }),
    ).toBeVisible();
    await expect(page.getByRole("status")).toHaveCount(0);
    await page.getByRole("link", { name: "集合" }).click();
    await expect(page.getByRole("link", { name: /东京 2027/ })).toContainText(
      "东京 · 0 个地点",
    );
  });
});
