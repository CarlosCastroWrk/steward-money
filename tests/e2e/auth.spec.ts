import { test, expect } from "@playwright/test";
import { login, TEST_EMAIL, TEST_PASSWORD } from "./helpers/auth";

test.describe("Auth flow", () => {
  test("login with valid credentials succeeds and shows dashboard", async ({ page }) => {
    await login(page);
    // Dashboard should show Safe to Spend
    await expect(page.locator("text=Safe to Spend")).toBeVisible({ timeout: 15_000 });
  });

  test("invalid credentials shows error", async ({ page }) => {
    await page.goto("/login");
    await page.locator('input[type="email"]').fill(TEST_EMAIL);
    await page.locator('input[type="password"]').fill("wrong-password-12345");
    await page.locator('button[type="submit"]').click();
    // Should stay on login page
    await expect(page).toHaveURL(/\/login/);
  });

  test("unauthenticated visit to dashboard redirects to login", async ({ page }) => {
    // Clear any existing session by going to login directly with no cookies
    await page.context().clearCookies();
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
  });

  test("logout returns to login page", async ({ page }) => {
    await login(page);
    // Navigate to Settings to find logout
    await page.goto("/settings");
    const logoutBtn = page.locator("button", { hasText: /sign out|log out/i });
    if (await logoutBtn.count() > 0) {
      await logoutBtn.click();
      await expect(page).toHaveURL(/\/login/);
    } else {
      // Logout via More page
      await page.goto("/more");
      const moreLogout = page.locator("button, a", { hasText: /sign out|log out/i });
      await moreLogout.click();
      await expect(page).toHaveURL(/\/login/);
    }
  });
});
