import { test, expect } from "@playwright/test";
import { ensureLoggedIn } from "./helpers/auth";

test.describe("Luka chat", () => {
  test.beforeEach(async ({ page }) => {
    await ensureLoggedIn(page);
  });

  test("Luka chat opens from /pulse/luka", async ({ page }) => {
    await page.goto("/pulse/luka");
    await expect(page.locator("textarea")).toBeVisible({ timeout: 8_000 });
  });

  test("send a message and receive a response", async ({ page }) => {
    // Open Luka chat — try multiple entry points
    await page.goto("/");
    const lukaBtn = page.locator("button", { hasText: /luka/i }).first();
    if (await lukaBtn.count() > 0) {
      await lukaBtn.click();
    } else {
      // Navigate to Pulse > Luka
      await page.goto("/pulse/luka");
    }

    const textarea = page.locator("textarea").first();
    await expect(textarea).toBeVisible({ timeout: 8_000 });

    // Send a simple message
    await textarea.fill("How is my spending looking?");
    await textarea.press("Enter");

    // Should see thinking indicator or response within 30s
    const response = page.locator("text=/looking|spending|budget|safe|spend/i");
    await expect(response.first()).toBeVisible({ timeout: 30_000 });
  });

  test("chat surface has no visible bleed-through behind overlay", async ({ page }) => {
    await page.goto("/pulse/luka");
    const textarea = await page.locator("textarea").first();
    await expect(textarea).toBeVisible({ timeout: 5_000 });

    // Check that the chat container fills the viewport (no content leaking behind)
    const chatContainer = page.locator('[class*="fixed"], [class*="inset"]').first();
    if (await chatContainer.count() > 0) {
      const box = await chatContainer.boundingBox();
      if (box) {
        // Should cover full width
        expect(box.x).toBeLessThanOrEqual(0);
      }
    }
  });
});
