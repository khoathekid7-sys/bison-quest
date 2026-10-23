import { defineConfig } from "@playwright/test";

export const SITE_PORT = 3200;
export const CHECKER_PORT = 8799;
export const BASE = "/bison-quest/";

/**
 * End-to-end tests run against the same static build GitHub Pages serves
 * (under /bison-quest/), plus the real photo-checker Worker running locally
 * with no API key. Most tests mock the checker's answers at the network level.
 * Two engines (Chromium ≈ Android Chrome, WebKit ≈ iPhone Safari) × two
 * phone widths (375 px and 430 px).
 */
export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  fullyParallel: true,
  retries: 0,
  reporter: [["list"]],
  outputDir: "test-results",
  use: {
    baseURL: `http://localhost:${SITE_PORT}`,
    trace: "retain-on-failure",
    hasTouch: true,
    // The offline service worker is tested separately in pwa.spec.ts.
    serviceWorkers: "block",
  },
  projects: [
    { name: "chromium-375", use: { browserName: "chromium", viewport: { width: 375, height: 812 }, isMobile: true, deviceScaleFactor: 2 } },
    { name: "chromium-430", use: { browserName: "chromium", viewport: { width: 430, height: 932 }, isMobile: true, deviceScaleFactor: 2 } },
    { name: "webkit-375", use: { browserName: "webkit", viewport: { width: 375, height: 812 }, isMobile: true, deviceScaleFactor: 2 } },
    { name: "webkit-430", use: { browserName: "webkit", viewport: { width: 430, height: 932 }, isMobile: true, deviceScaleFactor: 2 } },
  ],
  webServer: [
    {
      command: `node node_modules/next/dist/bin/next build && node e2e/static-server.mjs ${SITE_PORT} /bison-quest`,
      port: SITE_PORT,
      timeout: 240_000,
      reuseExistingServer: false,
      env: {
        NEXT_PUBLIC_BASE_PATH: "/bison-quest",
        NEXT_PUBLIC_VERIFY_URL: `http://127.0.0.1:${CHECKER_PORT}`,
        NEXT_TELEMETRY_DISABLED: "1",
      },
    },
    {
      // The real Worker, no API key: anything not mocked must report "not set up".
      command: `npx wrangler dev --port ${CHECKER_PORT} --ip 127.0.0.1 --var ALLOWED_ORIGINS:http://localhost:${SITE_PORT}`,
      url: `http://127.0.0.1:${CHECKER_PORT}/status`,
      timeout: 120_000,
      reuseExistingServer: false,
      env: { WRANGLER_SEND_METRICS: "false" },
    },
  ],
});
