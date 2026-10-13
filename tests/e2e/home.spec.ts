import { expect, test } from "@playwright/test";

test.describe("home (en)", () => {
  test.use({ locale: "en-US" });

  test("renders the app shell in English", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle("PlaceBook");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(
      page.getByRole("heading", { level: 1, name: "PlaceBook" }),
    ).toBeVisible();
    await expect(page.getByText("No collections yet")).toBeVisible();
  });
});

test.describe("home (zh-CN)", () => {
  test.use({ locale: "zh-CN" });

  test("renders the app shell in Chinese", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
    await expect(page.getByText("还没有收藏")).toBeVisible();
  });
});
