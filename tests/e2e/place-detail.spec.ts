import type { Page } from "@playwright/test";
import { expect, expectNoHorizontalOverflow, test } from "./fixtures";

test.use({ locale: "en-US" });

test.beforeEach(async ({ signIn }) => {
  await signIn();
});

const KATZ = {
  provider: "google",
  providerPlaceId: "ChIJ-katz",
  name: "Katz's Delicatessen",
  formattedAddress: "205 E Houston St, New York, NY 10002, USA",
  lat: 40.7222319,
  lng: -73.9873866,
  category: "restaurant",
};

/** Creates a collection with Katz's in it and opens Katz's detail page. */
async function openKatz(page: Page) {
  await page.goto("/c/new");
  await page.getByLabel("Name").fill("NYC");
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page).toHaveURL(/\/c\/[0-9a-f-]{36}$/);
  const collectionId = new URL(page.url()).pathname.split("/")[2];
  const res = await page.request.post("/api/places", {
    data: {
      collectionId,
      candidate: KATZ,
      why: "Pastrami",
      sourceKind: "friend",
    },
  });
  expect(res.status()).toBe(201);
  await page.goto(`/c/${collectionId}`);
  await page.getByRole("link", { name: /Katz's Delicatessen/ }).click();
  await expect(page).toHaveURL(
    new RegExp(`/p/[0-9a-f-]{36}\\?from=${collectionId}$`),
  );
  return collectionId;
}

const HREFS = {
  appleNavigate:
    "https://maps.apple.com/?daddr=Katz's%20Delicatessen%2C%20205%20E%20Houston%20St%2C%20New%20York%2C%20NY%2010002%2C%20USA&dirflg=w",
  appleOpen:
    "https://maps.apple.com/?q=Katz's%20Delicatessen&ll=40.722232,-73.987387",
  googleOpen:
    "https://www.google.com/maps/search/?api=1&query=40.722232,-73.987387&query_place_id=ChIJ-katz",
  googleNavigate:
    "https://www.google.com/maps/dir/?api=1&destination=40.722232,-73.987387&destination_place_id=ChIJ-katz&travelmode=walking",
};

test("links to Apple Maps and Google Maps with the exact §6.3 URLs", async ({
  page,
}) => {
  await openKatz(page);
  await expect(
    page.getByRole("heading", { name: "Katz's Delicatessen" }),
  ).toBeVisible();

  // Apple Maps is the default navigation app.
  const links = page
    .getByRole("region", { name: "More ways to open" })
    .getByRole("link");
  await expect(links.first()).toHaveText("Directions in Apple Maps");
  await expect(
    page.getByRole("link", { name: "Directions in Apple Maps" }),
  ).toHaveAttribute("href", HREFS.appleNavigate);
  await expect(
    page.getByRole("link", { name: "Open in Apple Maps" }),
  ).toHaveAttribute("href", HREFS.appleOpen);
  await expect(
    page.getByRole("link", { name: "Open in Google Maps" }),
  ).toHaveAttribute("href", HREFS.googleOpen);
  await expect(
    page.getByRole("link", { name: "Directions in Google Maps" }),
  ).toHaveAttribute("href", HREFS.googleNavigate);
  await expectNoHorizontalOverflow(page);

  // Switching the default puts Google Maps first.
  await page.goto("/settings");
  await page
    .getByRole("group", { name: "Default navigation app" })
    .getByRole("button", { name: "Google Maps" })
    .click();
  await expect(
    page
      .getByRole("group", { name: "Default navigation app" })
      .getByRole("button", { name: "Google Maps" }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.goBack();
  await page.reload();
  await expect(links.first()).toHaveText("Directions in Google Maps");
  await expect(links.first()).toHaveAttribute("href", HREFS.googleNavigate);
});

test("updates status and priority, reflected in the collection", async ({
  page,
}) => {
  const collectionId = await openKatz(page);
  const status = page.getByRole("group", { name: "Status" });
  await status.getByRole("button", { name: "Visited" }).click();
  await expect(status.getByRole("button", { name: "Visited" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  const priority = page.getByRole("group", { name: "Priority" });
  await priority.getByRole("button", { name: "Must go" }).click();
  await expect(
    priority.getByRole("button", { name: "Must go" }),
  ).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("link", { name: "NYC" }).first().click();
  await expect(page).toHaveURL(new RegExp(`/c/${collectionId}$`));
  const item = page
    .getByRole("listitem")
    .filter({ hasText: "Katz's Delicatessen" });
  await expect(item).toContainText("Visited");
  await expect(item).toContainText("Must go");

  await page.getByRole("button", { name: "Filter & sort" }).click();
  await page
    .getByRole("navigation", { name: "Status" })
    .getByRole("link", { name: "Visited 1" })
    .click();
  await expect(page.getByRole("listitem")).toHaveCount(1);
  await page
    .getByRole("navigation", { name: "Status" })
    .getByRole("link", { name: "Want to go 0" })
    .click();
  await expect(page.getByText("No places match these filters.")).toBeVisible();
});

test("adds and deletes reasons and sources", async ({ page }) => {
  await openKatz(page);
  const mentions = page.getByRole("listitem").filter({ hasText: "Pastrami" });
  await expect(mentions).toContainText("A friend");

  await page.locator("summary", { hasText: "Add a reason or source" }).click();
  // Passes the browser's URL check but must be rejected by the server.
  await page.getByLabel("Source link").fill("javascript:alert(1)");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "http" })).toHaveText(
    "The source link must start with http(s)://",
  );
  await page.getByLabel("Source link").fill("");

  await page.getByLabel("Why go").fill("Open late");
  await page.getByLabel("Source", { exact: true }).selectOption("xiaohongshu");
  await page.getByLabel("Source link").fill("https://example.com/post/42");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  const added = page.getByRole("listitem").filter({ hasText: "Open late" });
  await expect(added).toContainText("Xiaohongshu");
  await expect(
    added.getByRole("link", { name: "example.com" }),
  ).toHaveAttribute("href", "https://example.com/post/42");
  // The form clears for the next one.
  await expect(page.getByLabel("Why go")).toHaveValue("");

  await mentions.getByRole("button", { name: "Delete this" }).click();
  await expect(
    page.getByRole("listitem").filter({ hasText: "Pastrami" }),
  ).toHaveCount(0);
  await expect(added).toBeVisible();
});

test("edits name, category, note and tags", async ({ page }) => {
  await openKatz(page);
  await page.getByText("Name, category, note, tags").click();
  await page.getByLabel("Name", { exact: true }).fill("Katz's (LES)");
  await page.getByLabel("Category").selectOption("bar");
  await page.getByLabel("Note").fill("Cash only?");
  await page.getByLabel("Tags (comma-separated)").fill("deli, 深夜，late");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Saved ✓")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Katz's (LES)" }),
  ).toBeVisible();
  await expect(page.locator("header p")).toContainText("Bar");
  await expect(page.getByLabel("Tags (comma-separated)")).toHaveValue(
    "deli, 深夜, late",
  );
});

test("removes from a collection and deletes a place", async ({ page }) => {
  const collectionId = await openKatz(page);
  const placeUrl = page.url();
  await page.getByRole("button", { name: "Remove from “NYC”" }).click();
  await expect(page).toHaveURL(new RegExp(`/c/${collectionId}$`));
  await expect(page.getByText("No places yet")).toBeVisible();

  // Still exists on its own; now delete it for good.
  await page.goto(placeUrl.split("?")[0]);
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete this place" }).click();
  await expect(page).toHaveURL(/\/$/);
  const res = await page.goto(placeUrl.split("?")[0]);
  expect(res?.status()).toBe(404);
});

test("keeps places private to their owner", async ({
  page,
  browser,
  baseURL,
}) => {
  await openKatz(page);
  const url = page.url().split("?")[0];
  const { addSessionCookie } = await import("./fixtures");
  const other = await browser.newContext();
  await addSessionCookie(other, baseURL!, "e2e-someone-else");
  const res = await (await other.newPage()).goto(url);
  expect(res?.status()).toBe(404);
  await other.close();
});

test("switches the interface language in settings", async ({ page }) => {
  await page.goto("/settings");
  await page
    .getByRole("group", { name: "Language" })
    .getByRole("button", { name: "中文" })
    .click();
  await expect(page.getByRole("heading", { name: "设置" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
  await page
    .getByRole("group", { name: "界面语言" })
    .getByRole("button", { name: "跟随系统" })
    .click();
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
});
