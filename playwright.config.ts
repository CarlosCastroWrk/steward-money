import { defineConfig, devices } from "@playwright/test";
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
        ...devices["iPhone 14"],  // 390×844, touch events, mobile UA
        viewport: { width: 390, height: 844 },
      },
    },
    {
      name: "desktop",
      use: {
        viewport: { width: 1440, height: 900 },
        deviceScaleFactor: 1,
      },
    },
  ],
});
