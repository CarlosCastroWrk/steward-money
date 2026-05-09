import { test } from "@playwright/test";
import path from "path";
import fs from "fs";
import { ensureLoggedIn } from "./helpers/auth";

const SCREENSHOT_DIR = path.join(__dirname, "__screenshots__");

test.describe("Visual regression — full-page screenshots", () => {
  test.beforeAll(() => {
    if (!fs.existsSync(SCREENSHOT_DIR)) {
      fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    }
  });

  test.beforeEach(async ({ page }) => {
    await ensureLoggedIn(page);
  });

  const pages = [
    { name: "dashboard", path: "/" },
    { name: "pulse", path: "/pulse" },
    { name: "pulse-luka", path: "/pulse/luka" },
    { name: "pulse-solomon", path: "/pulse/solomon" },
    { name: "transactions", path: "/transactions" },
    { name: "bills", path: "/bills" },
    { name: "goals", path: "/goals" },
    { name: "accounts", path: "/accounts" },
    { name: "more", path: "/more" },
    { name: "more-memory", path: "/more/memory" },
    { name: "settings", path: "/settings" },
  ];

  for (const pg of pages) {
    test(`screenshot: ${pg.name}`, async ({ page }, testInfo) => {
      await page.goto(pg.path);
      await page.waitForLoadState("networkidle");
      // Brief pause for animations to settle
      await page.waitForTimeout(800);

      const project = testInfo.project.name;
      const filename = `${project}-${pg.name}-${Date.now()}.png`;
      const filePath = path.join(SCREENSHOT_DIR, filename);

      await page.screenshot({
        path: filePath,
        fullPage: true,
      });

      console.log(`Saved: ${filename}`);
    });
  }
});
