import { defineConfig } from "@playwright/test";
import { config as loadEnv } from "dotenv";
import path from "path";

// Load .env.test.local so TEST_USER_EMAIL / TEST_USER_PASSWORD are available in tests
loadEnv({ path: path.resolve(__dirname, ".env.test.local") });

const TEST_URL = process.env.TEST_URL || "https://steward-money-w8m8.vercel.app";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,       // sequential — tests share auth state
  retries: 1,
  reporter: [["list"], ["html", { open: "never" }]],

  use: {
    baseURL: TEST_URL,
    screenshot: "only-on-failure",
    video: "off",
    trace: "on-first-retry",
  },

  projects: [
    {
      name: "mobile",
      use: {
        // Chromium only (webkit/safari not installed). Simulate iPhone 14 dimensions + touch.
        browserName: "chromium",
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
        userAgent:
          "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
      },
    },
    {
      name: "desktop",
      use: {
        browserName: "chromium",
        viewport: { width: 1440, height: 900 },
        deviceScaleFactor: 1,
      },
    },
  ],
});
