import { type Page } from "@playwright/test";

export const TEST_EMAIL = process.env.TEST_USER_EMAIL || "";
export const TEST_PASSWORD = process.env.TEST_USER_PASSWORD || "";

export async function login(page: Page) {
  await page.goto("/login");
  await page.locator('input[type="email"]').fill(TEST_EMAIL);
  await page.locator('input[type="password"]').fill(TEST_PASSWORD);
  await page.locator('button[type="submit"]').click();
  // Wait for any redirect away from /login (may land on / or /onboarding)
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 15_000 });
}

export async function ensureLoggedIn(page: Page) {
  await page.goto("/");
  const url = page.url();
  if (url.includes("/login")) {
    await login(page);
  }
  // If onboarding isn't complete the middleware sends us to /onboarding.
  // Tests that call ensureLoggedIn need an onboarded account — skip with a clear message.
  if (page.url().includes("/onboarding")) {
    throw new Error(
      "Test account has not completed onboarding. " +
      "Visit the app, log in as hello@firstcallm.com, and finish onboarding before running tests."
    );
  }
}
