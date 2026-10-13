import type { Page } from "@playwright/test";
import { expect, expectNoHorizontalOverflow, test } from "./fixtures";

test.use({ locale: "en-US" });

test.beforeEach(async ({ signIn }) => {
  await signIn();
});

async function createCollection(page: Page, name: string, city?: string) {
  await page.goto("/c/new");
  await page.getByLabel("Name").fill(name);
  if (city) await page.getByLabel("City (optional)").fill(city);
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page.getByRole("heading", { name })).toBeVisible();
  return page.url();
}

test("finds, confirms and saves a place in two taps after typing", async ({
  page,
}) => {
  const collectionUrl = await createCollection(page, "NYC", "New York");

  // Tap 1: open the add page.
  await page.getByRole("link", { name: "Add place" }).click();
  const query = page.getByLabel("Place name");
  await expect(query).toBeFocused();
  await query.fill("Katz's");

  const katz = page.getByRole("radio", { name: /Katz's Delicatessen/ });
  await expect(katz).toBeVisible();
  await expect(katz).toHaveAttribute("aria-checked", "true");
  await expect(katz).toContainText("Restaurant");
  await expect(katz).toContainText("205 E Houston St");
  await expect(page.getByText("Preferring places near New York")).toBeVisible();
  await expect(page.getByRole("radio")).toHaveCount(2);
  await expectNoHorizontalOverflow(page);

  // Tap 2: save the preselected first candidate.
  await page
    .getByRole("button", { name: "Save “Katz's Delicatessen”" })
    .click();
  await expect(page.getByRole("status")).toHaveText("Saved ✓");
  await expect(query).toHaveValue("");
  await expect(query).toBeFocused();
  await expect(page.getByText("Just added (1)")).toBeVisible();

  await page.goto(collectionUrl);
  await expect(page.getByText("Katz's Delicatessen")).toBeVisible();
  await expect(page.getByText("Restaurant · 205 E Houston St")).toBeVisible();
});

test("adds several places in a row with reasons and tags", async ({ page }) => {
  const collectionUrl = await createCollection(page, "NYC food", "New York");
  await page.goto(`${collectionUrl}/add`);

  await page.getByLabel("Place name").fill("Katz's");
  await page.getByRole("radio", { name: /Katz's Merch Shop/ }).click();
  await page.getByText("Add a reason, source, tags (optional)").click();
  await page.getByLabel("Why go").fill("Souvenir tote");
  await page.getByLabel("Source", { exact: true }).selectOption("instagram");
  await page.getByLabel("Source link").fill("https://example.com/p/1");
  await page.getByLabel("Tags (comma-separated)").fill("gifts, merch");
  await page.getByText("Must go").click();
  await expectNoHorizontalOverflow(page);
  await page.getByRole("button", { name: "Save “Katz's Merch Shop”" }).click();
  await expect(page.getByRole("status")).toHaveText("Saved ✓");
  // Details are cleared for the next place.
  await expect(page.getByLabel("Why go")).toBeHidden();

  await page.getByLabel("Place name").fill("Katz's");
  await page
    .getByRole("button", { name: "Save “Katz's Delicatessen”" })
    .click();
  await expect(page.getByText("Just added (2)")).toBeVisible();

  await page.goto(collectionUrl);
  await expect(page.getByRole("listitem")).toHaveCount(2);
});

test("reuses a place saved before and says so", async ({ page }) => {
  const nyc = await createCollection(page, "NYC", "New York");
  const food = await createCollection(page, "Food", "New York");

  await page.goto(`${nyc}/add`);
  await page.getByLabel("Place name").fill("Katz's");
  await page
    .getByRole("button", { name: /^Save “Katz's Delicatessen”/ })
    .click();
  await expect(page.getByRole("status")).toHaveText("Saved ✓");

  await page.getByLabel("Place name").fill("Katz's");
  await page
    .getByRole("button", { name: /^Save “Katz's Delicatessen”/ })
    .click();
  await expect(page.getByRole("status")).toHaveText(
    "This place is already in this collection",
  );

  await page.goto(`${food}/add`);
  await page.getByLabel("Place name").fill("Katz's");
  await page
    .getByRole("button", { name: /^Save “Katz's Delicatessen”/ })
    .click();
  await expect(page.getByRole("status")).toHaveText(
    "Already saved; added the new reason to it",
  );
  await page.goto(food);
  await expect(page.getByText("Katz's Delicatessen")).toBeVisible();
});

test("says when nothing matches", async ({ page }) => {
  const url = await createCollection(page, "Empty search", "New York");
  await page.goto(`${url}/add`);
  await page.getByLabel("Place name").fill("zzzz no such place");
  await expect(page.getByText("No matching places.")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Save", exact: true }),
  ).toBeDisabled();
});

test("labels results from the backup provider", async ({ page }) => {
  const url = await createCollection(page, "Fallback", "New York");
  await page.route("**/api/search", (route) =>
    route.fulfill({
      json: {
        ok: true,
        query: "Joe's Pizza",
        provider: "nominatim",
        usedFallback: true,
        cached: false,
        bias: null,
        candidates: [
          {
            provider: "nominatim",
            providerPlaceId: "N123",
            name: "Joe's Pizza",
            formattedAddress: "7 Carmine St, New York",
            lat: 40.7306,
            lng: -74.0021,
            category: "restaurant",
            score: 1,
          },
        ],
      },
    }),
  );
  await page.goto(`${url}/add`);
  await page.getByLabel("Place name").fill("Joe's Pizza");
  await expect(
    page.getByText(/Backup data source \(OpenStreetMap\)/),
  ).toBeVisible();
  await page.getByRole("button", { name: "Save “Joe's Pizza”" }).click();
  await expect(page.getByRole("status")).toHaveText("Saved ✓");
  await page.goto(url);
  await expect(page.getByText("Joe's Pizza")).toBeVisible();
});

test("shows search errors and keeps the draft across a reload", async ({
  page,
}) => {
  const url = await createCollection(page, "Offline", "New York");
  await page.route("**/api/search", (route) =>
    route.fulfill({ status: 502, json: { error: "provider_unavailable" } }),
  );
  await page.goto(`${url}/add`);
  await page.getByLabel("Place name").fill("Katz's");
  await expect(
    page.getByText("Search is unavailable right now. Try again soon."),
  ).toBeVisible();
  await page.getByText("Add a reason, source, tags (optional)").click();
  await page.getByLabel("Why go").fill("Pastrami");

  await page.unroute("**/api/search");
  await page.reload();
  await expect(page.getByLabel("Place name")).toHaveValue("Katz's");
  await expect(page.getByLabel("Why go")).toHaveValue("Pastrami");
  await expect(
    page.getByRole("radio", { name: /Katz's Delicatessen/ }),
  ).toBeVisible();
});

test("rejects a source link that is not a web address", async ({ page }) => {
  const url = await createCollection(page, "Bad link", "New York");
  await page.goto(`${url}/add`);
  await page.getByLabel("Place name").fill("Katz's");
  await page.getByText("Add a reason, source, tags (optional)").click();
  await page.getByLabel("Source link").fill("javascript:alert(1)");
  await page
    .getByRole("button", { name: /^Save “Katz's Delicatessen”/ })
    .click();
  await expect(page.getByRole("alert").filter({ hasText: "http" })).toHaveText(
    "The source link must start with http(s)://",
  );
});

test.describe("in Chinese", () => {
  test.use({ locale: "zh-CN" });

  test("matches a mixed Chinese query", async ({ page }) => {
    await page.goto("/c/new");
    await page.getByLabel("名称").fill("纽约");
    await page.getByLabel("城市（可选）").fill("New York");
    await page.getByRole("button", { name: "创建" }).click();
    await page.getByRole("link", { name: "添加地点" }).click();
    await page.getByLabel("地点名称").fill("纽约 Lilia 意面");
    const lilia = page.getByRole("radio", { name: /Lilia/ });
    await expect(lilia).toHaveAttribute("aria-checked", "true");
    await expect(lilia).toContainText("餐厅");
    await expect(
      page.getByRole("radio", { name: /现代艺术博物馆/ }),
    ).toContainText("博物馆");
    await page.getByRole("button", { name: "保存「Lilia」" }).click();
    await expect(page.getByRole("status")).toHaveText("已保存 ✓");
  });
});
