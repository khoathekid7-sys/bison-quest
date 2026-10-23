import { expect, test } from "@playwright/test";
import { BASE } from "./helpers";

test.use({ serviceWorkers: "allow" });

test("installable: manifest, icons and home-screen metadata are valid", async ({ page, request }) => {
  await page.goto(BASE);
  const href = await page.locator('link[rel="manifest"]').getAttribute("href");
  expect(href).toBe(`${BASE}manifest.webmanifest`);
  const manifest = await (await request.get(href!)).json();
  expect(manifest).toMatchObject({ name: "Bison Quest", display: "standalone", start_url: BASE, scope: BASE });
  const sizes = manifest.icons.map((i: { sizes: string; purpose: string }) => `${i.sizes}/${i.purpose}`);
  expect(sizes).toEqual(expect.arrayContaining(["192x192/any", "512x512/any", "512x512/maskable"]));
  for (const icon of manifest.icons) {
    const res = await request.get(icon.src);
    expect(res.ok(), icon.src).toBe(true);
    expect(res.headers()["content-type"]).toContain("image/png");
  }
  const apple = await page.locator('link[rel="apple-touch-icon"]').getAttribute("href");
  expect((await request.get(apple!)).ok()).toBe(true);
  await expect(page.locator('meta[name="mobile-web-app-capable"], meta[name="apple-mobile-web-app-capable"]').first()).toBeAttached();
});

test("works offline after the first visit (service worker)", async ({ page, context, browserName }) => {
  test.skip(browserName !== "chromium", "Playwright's WebKit doesn't support offline service-worker testing");
  await page.goto(BASE);
  await expect(page.getByRole("button", { name: "Start exploring" })).toBeVisible();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  // Second load so the worker controls the page and caches the app's files.
  await page.reload();
  await expect(page.getByRole("button", { name: "Start exploring" })).toBeVisible();
  await page.evaluate(() => fetch("map/campus-map.json").then((r) => r.ok));

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("heading", { name: /Bison Quest/ })).toBeVisible();
  await page.getByRole("button", { name: "Start exploring" }).click();
  await expect(page.getByText("Before you set out")).toBeVisible();
});

test("Add to Home Screen help is reachable from the welcome screen", async ({ page }) => {
  await page.goto(BASE);
  await page.getByRole("button", { name: "Add to Home Screen" }).click();
  await expect(page.getByRole("dialog")).toContainText("Add to Home Screen");
  await expect(page.getByText("iPhone or iPad (Safari)")).toBeVisible();
  await expect(page.getByText("Android (Chrome)")).toBeVisible();
  await expect(page.getByText(/keep separate progress/)).toBeVisible();
});
