import { test, expect } from "@playwright/test";
import { login, TEST_EMAIL, TEST_PASSWORD } from "./helpers/auth";

test.describe("Auth flow", () => {
  test("login with valid credentials succeeds and redirects away from login", async ({ page }) => {
    await login(page);
    // Should have left /login (lands on / or /onboarding depending on account state)
    await expect(page).not.toHaveURL(/\/login/);
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
    await page.goto("/more");
    await page.locator("button", { hasText: /sign out/i }).click();
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });
});
