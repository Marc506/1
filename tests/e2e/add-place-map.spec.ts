import type { Page } from "@playwright/test";
import { expect, expectNoHorizontalOverflow, test } from "./fixtures";

test.use({ locale: "en-US" });

test.beforeEach(async ({ signIn }) => {
  await signIn();
});

async function openAddPage(page: Page, city = "New York") {
  await page.goto("/c/new");
  await page.getByLabel("Name").fill("Map test");
  await page.getByLabel("City (optional)").fill(city);
  await page.getByRole("button", { name: "Create" }).click();
  await page.getByRole("link", { name: "Add place" }).click();
}

test("shows numbered pins and selects a candidate from the map", async ({
  page,
}) => {
  await openAddPage(page);
  await page.getByLabel("Place name").fill("Katz's");
  await expect(page.getByTestId("candidate-map")).toBeVisible();

  const pins = page.getByTestId("map-pin");
  await expect(pins).toHaveCount(2);
  await expect(
    page.getByRole("button", { name: "1. Katz's Delicatessen" }),
  ).toHaveAttribute("data-active", "true");

  await page.getByRole("button", { name: "2. Katz's Merch Shop" }).click();
  await expect(
    page.getByRole("radio", { name: /Katz's Merch Shop/ }),
  ).toHaveAttribute("aria-checked", "true");
  await expect(
    page.getByRole("button", { name: "2. Katz's Merch Shop" }),
  ).toHaveAttribute("data-active", "true");
  await expectNoHorizontalOverflow(page);
});

test("places a pin by hand when nothing matches", async ({ page }) => {
  await openAddPage(page);
  await page.getByLabel("Place name").fill("Secret pop-up");
  await expect(page.getByText("No matching places.")).toBeVisible();

  await page
    .getByRole("button", { name: "None of these? Place it yourself" })
    .click();
  const picker = page.getByTestId("pin-picker-map");
  await expect(picker).toBeVisible();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue(
    "Secret pop-up",
  );
  await page.getByLabel("Category").selectOption("market");
  await expectNoHorizontalOverflow(page);

  // The pin starts on the city center from the mock (40.7127753, -74.0059728).
  const coords = page.getByTestId("pin-coordinates");
  await expect(coords).toHaveText("40.71278, -74.00597");

  // Pan the map: the pin stays centered, so the saved point moves.
  const box = (await picker.boundingBox())!;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx - 80, cy + 60, { steps: 8 });
  await page.mouse.up();
  await expect(coords).not.toHaveText("40.71278, -74.00597");

  const save = page.getByRole("button", {
    name: "Save “Secret pop-up” (placed by hand)",
  });
  await expect(save).toBeEnabled();
  const request = page.waitForRequest("**/api/places");
  await save.click();
  const body = (await request).postDataJSON();
  expect(body.candidate).toMatchObject({
    provider: "manual",
    providerPlaceId: null,
    name: "Secret pop-up",
    category: "market",
  });
  // Dragging the map left and down moves the center east and north.
  expect(body.candidate.lng).toBeGreaterThan(-74.0059728);
  expect(body.candidate.lat).toBeGreaterThan(40.7127753);
  await expect(page.getByRole("status")).toHaveText("Saved ✓");

  // Back to search mode, ready for the next place.
  await expect(picker).toBeHidden();
  await expect(page.getByLabel("Place name")).toHaveValue("");
});

test("can go back from manual placement to the results", async ({ page }) => {
  await openAddPage(page);
  await page.getByLabel("Place name").fill("Katz's");
  await page
    .getByRole("button", { name: "None of these? Place it yourself" })
    .click();
  await expect(page.getByRole("radio")).toHaveCount(0);
  await page.getByRole("button", { name: "Back to results" }).click();
  await expect(page.getByRole("radio")).toHaveCount(2);
});
