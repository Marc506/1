import type { APIRequestContext, Page } from "@playwright/test";
import { expect, expectNoHorizontalOverflow, test } from "./fixtures";

test.use({ locale: "en-US" });

test.beforeEach(async ({ signIn }) => {
  await signIn();
});

async function createCollection(page: Page): Promise<string> {
  await page.goto("/c/new");
  await page.getByLabel("Name").fill("NYC");
  await page.getByLabel("City (optional)").fill("New York");
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page).toHaveURL(/\/c\/[0-9a-f-]{36}$/);
  return new URL(page.url()).pathname.split("/")[2];
}

async function savePlace(
  request: APIRequestContext,
  collectionId: string,
  name: string,
  opts: {
    category?: string;
    tags?: string[];
    priority?: number;
    lat?: number;
    lng?: number;
  } = {},
) {
  const res = await request.post("/api/places", {
    data: {
      collectionId,
      candidate: {
        provider: "google",
        providerPlaceId: `seed-${name}`,
        name,
        formattedAddress: `${name} St, New York`,
        lat: opts.lat ?? 40.72,
        lng: opts.lng ?? -73.99,
        category: opts.category ?? "restaurant",
      },
      tags: opts.tags ?? [],
      priority: opts.priority ?? 1,
    },
  });
  expect(res.status()).toBe(201);
}

async function seed(page: Page) {
  const id = await createCollection(page);
  const r = page.request;
  await savePlace(r, id, "Katz's", {
    tags: ["deli", "late night"],
    lat: 40.7223,
    lng: -73.9874,
  });
  await savePlace(r, id, "Abraço", {
    category: "cafe",
    priority: 2,
    lat: 40.7268,
    lng: -73.9866,
  });
  await savePlace(r, id, "Lilia", {
    tags: ["late night"],
    priority: 0,
    lat: 40.7176,
    lng: -73.9524,
  });
  await savePlace(r, id, "MoMA", {
    category: "museum",
    lat: 40.7614,
    lng: -73.9776,
  });
  await page.goto(`/c/${id}`);
  return id;
}

/** Opens the collapsed filter panel (no-op when it is already open). */
async function openFilters(page: Page) {
  const status = page.getByRole("navigation", { name: "Status" });
  await expect(async () => {
    if (!(await status.isVisible())) {
      await page.getByRole("button", { name: "Filter & sort" }).click();
    }
    await expect(status).toBeVisible({ timeout: 1_000 });
  }).toPass();
}

function listNames(page: Page) {
  return page
    .getByRole("list", { name: "List" })
    .locator("li > a > div > span:first-child");
}

test("filters by category and tag, and sorts", async ({ page }) => {
  await seed(page);
  await expect(page.locator("header p")).toHaveText("New York · 4 places");
  await expect(listNames(page)).toHaveText([
    "MoMA",
    "Lilia",
    "Abraço",
    "Katz's",
  ]);
  await expectNoHorizontalOverflow(page);

  // Filters start collapsed so the list sits near the top.
  await expect(page.getByRole("navigation", { name: "Category" })).toBeHidden();
  await openFilters(page);
  const categories = page.getByRole("navigation", { name: "Category" });
  await categories.getByRole("link", { name: "Restaurant 2" }).click();
  await expect(page).toHaveURL(/\?cat=restaurant$/);
  await expect(listNames(page)).toHaveText(["Lilia", "Katz's"]);
  await expect(
    categories.getByRole("link", { name: "Restaurant 2" }),
  ).toHaveAttribute("aria-current", "page");

  await page
    .getByRole("navigation", { name: "Tag" })
    .getByRole("link", { name: "#deli" })
    .click();
  await expect(listNames(page)).toHaveText(["Katz's"]);
  await expect(page).toHaveURL(/cat=restaurant&tag=deli/);

  await page.getByRole("link", { name: "Clear filters" }).click();
  await expect(listNames(page)).toHaveCount(4);

  await page
    .getByRole("navigation", { name: "Sort" })
    .getByRole("link", { name: "Priority" })
    .click();
  await expect(listNames(page).first()).toHaveText("Abraço");
  await expect(listNames(page).last()).toHaveText("Lilia");
  await page
    .getByRole("navigation", { name: "Sort" })
    .getByRole("link", { name: "Name" })
    .click();
  await expect(listNames(page)).toHaveText([
    "Abraço",
    "Katz's",
    "Lilia",
    "MoMA",
  ]);

  // Badges for must-go and tags.
  await expect(
    page.getByRole("listitem").filter({ hasText: "Abraço" }),
  ).toContainText("Must go");
  await expect(
    page.getByRole("listitem").filter({ hasText: "Katz's" }),
  ).toContainText("#late night");
});

test("shows an empty result with a way out", async ({ page }) => {
  const id = await seed(page);
  await page.goto(`/c/${id}?cat=museum&tag=deli`);
  await expect(page.getByText("No places match these filters.")).toBeVisible();
  await page.getByRole("link", { name: "Clear filters" }).first().click();
  await expect(listNames(page)).toHaveCount(4);
});

test("shows places as category-colored pins on the map", async ({ page }) => {
  const id = await seed(page);
  await page.getByRole("link", { name: "Map", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/c/${id}\\?view=map$`));
  const map = page.getByTestId("collection-map");
  await expect(map).toHaveAttribute("data-mode", "markers");
  const pins = page.getByTestId("place-pin");
  await expect(pins).toHaveCount(4);

  // Filters apply to the map too.
  await openFilters(page);
  await page
    .getByRole("navigation", { name: "Category" })
    .getByRole("link", { name: "Café 1" })
    .click();
  await expect(page).toHaveURL(/view=map&cat=cafe/);
  await expect(pins).toHaveCount(1);

  await page.getByRole("button", { name: "Abraço" }).click();
  await expect(page.locator(".maplibregl-popup")).toContainText(
    "Café · Abraço St, New York",
  );
  await expectNoHorizontalOverflow(page);
});

test("clusters a large collection", async ({ page }) => {
  test.slow();
  const id = await createCollection(page);
  for (let i = 0; i < 100; i++) {
    await savePlace(page.request, id, `Place ${i}`, {
      lat: 40.7 + (i % 10) * 0.01,
      lng: -74 + Math.floor(i / 10) * 0.01,
    });
  }
  await page.goto(`/c/${id}?view=map`);
  await expect(page.getByTestId("collection-map")).toHaveAttribute(
    "data-mode",
    "clustered",
  );
  await expect(page.getByTestId("place-pin")).toHaveCount(0);
});
