import { expect, test } from "@playwright/test";
import { gemAt, grantLocation, mockVerify, startLiveHunt } from "./helpers";

// Chromium can provide a synthetic camera; WebKit can't, so WebKit runs the
// fallback path in journey.spec.ts instead.
test.use({
  launchOptions: { args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] },
});

test("in-app rear camera captures a photo and releases the camera on close", async ({ page, context, browserName }) => {
  test.skip(browserName !== "chromium", "Synthetic camera is only available in Chromium");
  await context.grantPermissions(["camera", "geolocation"]);
  await page.addInitScript(() => {
    const w = window as unknown as { __streams: MediaStream[] };
    w.__streams = [];
    const orig = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async (c) => {
      const s = await orig(c);
      w.__streams.push(s);
      return s;
    };
  });
  await grantLocation(context, gemAt(0));
  await mockVerify(page, () => "pass");
  await startLiveHunt(page);

  await page.getByRole("button", { name: /^(Open camera|Take photo:)/ }).click();
  await expect(page.getByRole("button", { name: "Take photo" })).toBeVisible();
  const facing = await page.evaluate(() => {
    const w = window as unknown as { __streams: MediaStream[] };
    return w.__streams[0]?.getVideoTracks()[0]?.readyState;
  });
  expect(facing).toBe("live");

  // Closing the camera stops every track.
  await page.getByRole("button", { name: /Close camera/ }).click();
  await expect(page.getByText(/Gem 1 of 2/)).toBeVisible();
  const states = await page.evaluate(() =>
    (window as unknown as { __streams: MediaStream[] }).__streams.flatMap((s) => s.getTracks().map((t) => t.readyState)),
  );
  expect(states.length).toBeGreaterThan(0);
  expect(states.every((s) => s === "ended")).toBe(true);

  // Capture → review → submit.
  await page.getByRole("button", { name: /^(Open camera|Take photo:)/ }).click();
  await page.getByRole("button", { name: "Take photo" }).click();
  await expect(page.getByRole("img", { name: "Your photo, ready to check" })).toBeVisible();
  await page.getByRole("button", { name: "Use this photo" }).click();
  await expect(page.getByRole("heading", { name: "Story Gem!" })).toBeVisible();
  const after = await page.evaluate(() =>
    (window as unknown as { __streams: MediaStream[] }).__streams.flatMap((s) => s.getTracks().map((t) => t.readyState)),
  );
  expect(after.every((s) => s === "ended")).toBe(true);
});
