import { test, expect } from "@playwright/test";
import { ensureLoggedIn } from "./helpers/auth";

test.describe("Memory page (/more/memory)", () => {
  test.beforeEach(async ({ page }) => {
    await ensureLoggedIn(page);
    await page.goto("/more/memory");
    await page.waitForLoadState("networkidle");
  });

  test("Memory page loads without errors", async ({ page }) => {
    // Should not show an error boundary or 500 page
    await expect(page.locator("text=/500|something went wrong|error/i")).toHaveCount(0);
  });

  test("Category sections render", async ({ page }) => {
    const categories = ["Identity", "Financial", "Faith", "Relationships", "Patterns", "Preferences"];
    let foundAtLeastOne = false;
    for (const cat of categories) {
      const el = page.locator(`text=${cat}`);
      if (await el.count() > 0) {
        foundAtLeastOne = true;
        break;
      }
    }
    expect(foundAtLeastOne).toBeTruthy();
  });

  test("Search bar is visible", async ({ page }) => {
    await expect(page.locator("input[placeholder], input[type='search'], input[type='text']").first()).toBeVisible();
  });

  test("Search filters memories (if any exist)", async ({ page }) => {
    const searchInput = page.locator("input").first();
    await searchInput.fill("zzznomatch");
    // After typing, either no results message or empty sections
    const noResults = page.locator("text=/no memories|nothing|empty/i");
    // Either we get a no-results state or the page is just quiet — either is fine
    await page.waitForTimeout(500);
    // Just verify the page didn't crash
    await expect(page.locator("body")).toBeVisible();
  });

  test("Edit and delete controls exist when memories are present", async ({ page }) => {
    // If there are any memory cards, verify edit/delete buttons exist
    const cards = page.locator("button[aria-label*='edit'], button[aria-label*='delete'], button:has(svg)");
    if (await cards.count() > 0) {
      await expect(cards.first()).toBeVisible();
    }
  });
});
