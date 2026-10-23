import { expect, type BrowserContext, type Page, type Route } from "@playwright/test";
import sharp from "sharp";
import { HUNT } from "../src/config/hunt";
import { evaluateFix, offsetPoint } from "../src/lib/geo";

/** Where the static site is served in tests (same layout as GitHub Pages). */
export const BASE = "/bison-quest/";
/** The local photo-checker Worker (see playwright.config.ts). */
export const CHECKER = "http://127.0.0.1:8799";

export const TAYLOR = HUNT.placementRule.reference;
export const gemAt = (i: number, meters = 6) => offsetPoint(HUNT.gems[i].checkpoint, meters, 200);

let cachedPhoto: Buffer | null = null;
/** A non-blank JPEG that stands in for a real camera photo. */
export async function testPhoto(): Promise<Buffer> {
  if (cachedPhoto) return cachedPhoto;
  const w = 800;
  const h = 600;
  const raw = Buffer.alloc(w * h * 3);
  for (let i = 0; i < raw.length; i++) raw[i] = (i * 2654435761) % 251;
  cachedPhoto = await sharp(raw, { raw: { width: w, height: h, channels: 3 } }).jpeg().toBuffer();
  return cachedPhoto;
}

export async function grantLocation(context: BrowserContext, p: { lat: number; lng: number }, accuracy = 6) {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: p.lat, longitude: p.lng, accuracy });
}

const CORS = { "Access-Control-Allow-Origin": "*" };

export type MockVerdict = "pass" | "retry" | "uncertain" | "provider_error" | "network";

/**
 * Mocks the photo checker's POST /verify. The location half is computed with the app's real
 * evaluateFix() from the submitted form, so geofence logic is still exercised.
 */
export async function mockVerify(page: Page, next: () => MockVerdict) {
  const calls: string[] = [];
  await page.route(`${CHECKER}/verify`, async (route: Route) => {
    const v = next();
    calls.push(v);
    if (v === "network") return route.abort("internetdisconnected");
    if (v === "provider_error") {
      return route.fulfill({
        status: 502,
        headers: CORS,
        json: { ok: false, error: "provider_error", message: "The photo checker is temporarily unavailable. Try again in a moment.", retryable: true },
      });
    }
    const body = route.request().postDataBuffer()?.toString("latin1") ?? "";
    const field = (name: string) => body.match(new RegExp(`name="${name}"\\r\\n\\r\\n([^\\r]*)`))?.[1] ?? "";
    const gem = HUNT.gems.find((g) => g.id === field("gemId"))!;
    const now = Date.now();
    const location = evaluateFix(
      { lat: Number(field("lat")), lng: Number(field("lng")), accuracy: Number(field("accuracy")), timestamp: now - Number(field("fixAgeMs")) },
      gem,
      HUNT.gps,
      now,
      HUNT.placementRule,
    );
    if (!location.passed) return route.fulfill({ headers: CORS, json: { ok: true, location, photo: null, approved: false } });
    const photo =
      v === "pass"
        ? { verdict: "pass", reason: "Looks like the right place!", feedback: "", source: "live" }
        : v === "retry"
          ? { verdict: "retry", reason: "This looks like a different building.", feedback: "Include the entrance and more of the surrounding facade.", source: "live" }
          : { verdict: "uncertain", reason: "We couldn't tell for sure.", feedback: "Step back so the whole entrance fits.", source: "live" };
    return route.fulfill({ headers: CORS, json: { ok: true, location, photo, approved: v === "pass" } });
  });
  return calls;
}

/** If permission is already granted the app skips straight to "Location is on". */
export async function allowLocation(page: Page) {
  const on = page.getByText("Location is on");
  const allow = page.getByRole("button", { name: "Allow location" });
  await expect(on.or(allow)).toBeVisible();
  if (await allow.isVisible()) await allow.click({ timeout: 5_000 }).catch(() => {});
  await expect(on).toBeVisible({ timeout: 15_000 });
}

export async function startLiveHunt(page: Page) {
  await page.goto(BASE);
  await page.getByRole("button", { name: "Start exploring" }).click();
  await allowLocation(page);
  await page.getByRole("button", { name: "To the map!" }).click();
  await expect(page.getByText(/Gem 1 of 2/)).toBeVisible();
}

/** Opens the camera and supplies a photo through the "Choose a photo" fallback. */
export async function takePhoto(page: Page) {
  await page.getByRole("button", { name: /^(Open camera|Take photo:)/ }).click();
  await expect(page.getByText("What to capture")).toBeVisible();
  await page.getByTestId("file-library").setInputFiles({ name: "photo.jpg", mimeType: "image/jpeg", buffer: await testPhoto() });
  await expect(page.getByRole("button", { name: "Use this photo" })).toBeVisible();
}

export async function submitPhoto(page: Page) {
  await page.getByRole("button", { name: "Use this photo" }).click();
}

export async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}

/** Every visible button/link in the main UI is at least 44×44 CSS px. */
export async function expectTouchTargets(page: Page) {
  const small = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("button, a[href], [role=radio]")]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        const s = getComputedStyle(el);
        const inAttribution = el.closest(".leaflet-control-attribution");
        return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && !inAttribution && el.tabIndex !== -1;
      })
      .map((el) => ({ label: (el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 40), w: el.getBoundingClientRect().width, h: el.getBoundingClientRect().height }))
      .filter((b) => b.w < 44 || b.h < 44),
  );
  expect(small, JSON.stringify(small)).toEqual([]);
}
