import { type Page } from "@playwright/test";

export const TEST_EMAIL = process.env.TEST_USER_EMAIL || "";
export const TEST_PASSWORD = process.env.TEST_USER_PASSWORD || "";

export async function login(page: Page) {
  await page.goto("/login");
  await page.locator('input[type="email"]').fill(TEST_EMAIL);
  await page.locator('input[type="password"]').fill(TEST_PASSWORD);
  await page.locator('button[type="submit"]').click();
  // Wait for redirect to dashboard
  await page.waitForURL(/\/$/, { timeout: 15_000 });
}

export async function ensureLoggedIn(page: Page) {
  await page.goto("/");
  const url = page.url();
  if (url.includes("/login")) {
    await login(page);
  }
}
