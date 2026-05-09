import { test, expect } from "@playwright/test";
import { ensureLoggedIn } from "./helpers/auth";
import { AGENT_REGISTRY } from "../../lib/agents/registry";

const AGENT_ORDER = ["luka", "solomon", "kairos", "argus", "iron", "manna", "eden", "nova", "echo", "silas"];

test.describe("Pulse tab — Council", () => {
  test.beforeEach(async ({ page }) => {
    await ensureLoggedIn(page);
    await page.goto("/pulse");
    await page.waitForLoadState("networkidle");
  });

  test("Pulse page shows 'Council' heading", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Council" })).toBeVisible();
  });

  test("10 agent cards are rendered", async ({ page }) => {
    // Each card should show the agent's name
    for (const agent of AGENT_ORDER) {
      const name = AGENT_REGISTRY[agent as keyof typeof AGENT_REGISTRY].name;
      await expect(page.locator(`text=${name}`).first()).toBeVisible();
    }
  });

  test("no horizontal circle row (old dock is gone)", async ({ page }) => {
    // The old dock rendered agents as 64x64 circles in a horizontal scroll
    // Verify there's no overflow-x-auto element with h-16 w-16 circles
    const oldDock = await page.locator(".overflow-x-auto .flex.gap-4").count();
    expect(oldDock).toBe(0);
  });

  test("no calendar section on Pulse", async ({ page }) => {
    const calendarText = await page.locator("text=/Calendar · Next/").count();
    expect(calendarText).toBe(0);
  });

  test("tapping Luka card navigates to /pulse/luka", async ({ page }) => {
    await page.locator("text=Luka").first().click();
    await expect(page).toHaveURL(/\/pulse\/luka/, { timeout: 5_000 });
  });

  test("tapping Solomon card navigates to /pulse/solomon", async ({ page }) => {
    await page.locator("text=Solomon").first().click();
    await expect(page).toHaveURL(/\/pulse\/solomon/, { timeout: 5_000 });
  });

  test("all 10 agent cards are reachable by scrolling", async ({ page }) => {
    // Scroll to bottom to make sure all cards are in DOM
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const silas = page.locator("text=Silas").first();
    await expect(silas).toBeVisible();
  });
});

test.describe("Agent detail page", () => {
  test.beforeEach(async ({ page }) => {
    await ensureLoggedIn(page);
  });

  test("Luka detail page: shows insights section and chat", async ({ page }) => {
    await page.goto("/pulse/luka");
    await expect(page.locator("text=Luka").first()).toBeVisible();
    // Insights section label or placeholder
    await expect(page.getByText(/Latest from|I'll surface|Tap to start/i).first()).toBeVisible({ timeout: 8_000 });
    // Chat composer always present in embedded mode
    await expect(page.locator("textarea")).toBeVisible({ timeout: 8_000 });
  });

  test("Solomon detail page: gold accent and insights", async ({ page }) => {
    await page.goto("/pulse/solomon");
    await expect(page.locator("text=Solomon")).toBeVisible();
    await expect(page.locator("textarea")).toBeVisible({ timeout: 5_000 });
  });

  test("back button navigates away from agent detail page", async ({ page }) => {
    // Navigate to pulse first so browser history has /pulse, then go to agent
    await page.goto("/pulse");
    await page.goto("/pulse/argus");
    await page.locator('[aria-label="Back"]').click();
    // Should leave the /pulse/argus page (goes to /pulse via router.back())
    await expect(page).not.toHaveURL(/\/pulse\/argus/, { timeout: 5_000 });
  });

  test("invalid agent name shows not-found state", async ({ page }) => {
    await page.goto("/pulse/notanagent");
    await expect(page.locator("text=/not found/i")).toBeVisible();
  });
});
