import { expect, test } from "@playwright/test";
import {
  BASE,
  TAYLOR,
  allowLocation,
  expectNoHorizontalScroll,
  expectTouchTargets,
  gemAt,
  grantLocation,
  mockVerify,
  startLiveHunt,
  submitPhoto,
  takePhoto,
  type MockVerdict,
} from "./helpers";

test("complete live journey: both gems, album, refresh, export, reset", async ({ page, context }, info) => {
  await grantLocation(context, TAYLOR);
  const queue: MockVerdict[] = ["pass", "pass"];
  const calls = await mockVerify(page, () => queue.shift() ?? "pass");

  await page.goto(BASE);
  await expect(page.getByRole("heading", { name: /Bison Quest/ })).toBeVisible();
  await expectNoHorizontalScroll(page);
  await page.screenshot({ path: info.outputPath("01-welcome.png") });

  await page.getByRole("button", { name: "Start exploring" }).click();
  await allowLocation(page);
  await page.getByRole("button", { name: "To the map!" }).click();

  // Explore: clue visible, destination name hidden, distance labelled straight-line.
  await expect(page.getByText(/Gem 1 of 2/)).toBeVisible();
  await expect(page.getByText("Before your stories lived on a screen,")).toBeVisible();
  await expect(page.getByText(/straight-line/)).toBeVisible();
  await expect(page.getByText("Carnegie Building")).toHaveCount(0);
  await expect(page.getByText("ELC Uphill Patio")).toHaveCount(0);
  // The stylized campus base map (buildings + paths) renders.
  await expect(page.locator(".leaflet-buildings-pane path").first()).toBeAttached({ timeout: 15_000 });
  expect(await page.locator(".leaflet-buildings-pane path").count()).toBeGreaterThan(50);
  await expectNoHorizontalScroll(page);
  await expectTouchTargets(page);
  await page.screenshot({ path: info.outputPath("02-explore.png") });

  // Hints escalate; hint 2 names the place.
  await page.getByRole("button", { name: "Need a hint?" }).click();
  await expect(page.getByText(/Hint 1:/)).toBeVisible();
  await page.getByRole("button", { name: /Hint 2/ }).click();
  await expect(page.getByText(/It's the Carnegie Building/)).toBeVisible();

  // Walk to Carnegie.
  await context.setGeolocation({ latitude: gemAt(0).lat, longitude: gemAt(0).lng, accuracy: 6 });
  await expect(page.getByText("You're here! Take the photo.")).toBeVisible({ timeout: 25_000 });

  await takePhoto(page);
  await expect(page.getByText("In range: ready to submit")).toBeVisible();
  await page.screenshot({ path: info.outputPath("03-review.png") });
  await submitPhoto(page);
  await expect(page.getByText("Both checks passed!")).toBeVisible();
  await expect(page.getByText("Location check")).toBeVisible();
  await expect(page.getByText("Photo check")).toBeVisible();

  // Collect + discovery.
  await expect(page.getByRole("heading", { name: "Story Gem!" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "You found Bucknell's first library" })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole("link", { name: /Course Catalog/ })).toBeVisible();
  await page.screenshot({ path: info.outputPath("04-collect.png"), fullPage: true });

  // Refresh mid-celebration: the discovery is still there, and gem 2 is not double-unlocked.
  await page.reload();
  await expect(page.getByRole("heading", { name: "You found Bucknell's first library" })).toBeVisible();
  await page.getByRole("button", { name: "Reveal the next clue" }).click();
  await expect(page.getByText(/Gem 2 of 2/)).toBeVisible();
  await expect(page.getByRole("button", { name: /1 of 2 gems collected/ })).toBeVisible();

  // Gem 2.
  await context.setGeolocation({ latitude: gemAt(1).lat, longitude: gemAt(1).lng, accuracy: 6 });
  await expect(page.getByText("You're here! Take the photo.")).toBeVisible({ timeout: 25_000 });
  await takePhoto(page);
  await submitPhoto(page);
  await expect(page.getByRole("heading", { name: "Gathering Gem!" })).toBeVisible();
  await page.getByRole("button", { name: "Open my album" }).click();

  // Album with both real accepted photos.
  await expect(page.getByRole("heading", { name: "You found them all!" })).toBeVisible();
  await expect(page.getByRole("img", { name: "Your photo of Carnegie Building" })).toBeVisible();
  await expect(page.getByRole("img", { name: "Your photo of ELC Uphill Patio" })).toBeVisible();
  await expectNoHorizontalScroll(page);
  await page.screenshot({ path: info.outputPath("05-album.png"), fullPage: true });
  expect(calls).toEqual(["pass", "pass"]);

  // Refresh restores the finished album.
  await page.reload();
  await expect(page.getByRole("heading", { name: "You found them all!" })).toBeVisible();
  await expect(page.getByRole("img", { name: /Your photo of/ })).toHaveCount(2);

  // Individual download.
  const single = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save" }).first().click();
  expect((await single).suggestedFilename()).toBe("bison-quest-carnegie-building.jpg");

  // Combined album export (share sheet where supported, otherwise download).
  const combinedButton = page.getByRole("button", { name: /Download album image|Save album image/ });
  const combined = page.waitForEvent("download");
  await combinedButton.click();
  const dl = await combined;
  expect(dl.suggestedFilename()).toBe("bison-quest-album.jpg");
  const path = info.outputPath("album-export.jpg");
  await dl.saveAs(path);

  // Reset requires confirmation.
  await page.getByRole("button", { name: "Start the hunt over" }).click();
  await expect(page.getByRole("alertdialog")).toContainText("Restart the hunt?");
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("heading", { name: "You found them all!" })).toBeVisible();
  await page.getByRole("button", { name: "Start the hunt over" }).click();
  await page.getByRole("button", { name: "Yes, restart" }).click();
  await expect(page.getByText(/Gem 1 of 2/)).toBeVisible();
  await expect(page.getByRole("button", { name: /0 of 2 gems collected/ })).toBeVisible();
});

test("wrong photo at the right place is rejected with feedback; uncertain never awards", async ({ page, context }) => {
  await grantLocation(context, gemAt(0));
  const queue: MockVerdict[] = ["retry", "uncertain", "pass"];
  await mockVerify(page, () => queue.shift()!);
  await startLiveHunt(page);
  await expect(page.getByText("You're here! Take the photo.")).toBeVisible({ timeout: 25_000 });

  await takePhoto(page);
  await submitPhoto(page);
  await expect(page.getByText("That photo doesn't show the spot yet")).toBeVisible();
  await expect(page.getByText(/Include the entrance and more of the surrounding facade/)).toBeVisible();
  await expect(page.getByText("Passed")).toBeVisible(); // location passed
  await expect(page.getByText("Not yet")).toBeVisible(); // photo failed

  await page.getByRole("button", { name: "Retake photo" }).click();
  await page.getByTestId("file-library").setInputFiles({ name: "p2.jpg", mimeType: "image/jpeg", buffer: Buffer.from(await (await import("./helpers")).testPhoto()) });
  await submitPhoto(page);
  await expect(page.getByRole("heading", { name: "We couldn't tell for sure" })).toBeVisible();
  await expect(page.getByText("Unsure")).toBeVisible();

  await page.getByRole("button", { name: "Back to map" }).click();
  await expect(page.getByRole("button", { name: /0 of 2 gems collected/ })).toBeVisible();

  // The pending photo was kept: reopening the camera shows it, ready to resubmit.
  await page.getByRole("button", { name: /saved photo/ }).click();
  await expect(page.getByText("Your saved photo from earlier")).toBeVisible();
  await submitPhoto(page);
  await expect(page.getByRole("heading", { name: "Story Gem!" })).toBeVisible();
});

test("correct photo outside the geofence fails the location check; photo is kept", async ({ page, context }) => {
  await grantLocation(context, TAYLOR);
  const calls = await mockVerify(page, () => "pass");
  await startLiveHunt(page);
  await takePhoto(page);
  await expect(page.getByText(/Not in range yet/)).toBeVisible();
  await submitPhoto(page);
  await expect(page.getByText("Almost there")).toBeVisible();
  await expect(page.getByText(/We check the photo once your location passes/)).toBeVisible();
  expect(calls).toEqual([]); // the photo was never sent
  await page.getByRole("button", { name: "Back to map (photo saved)" }).click();

  // Walk closer and retry without retaking.
  await context.setGeolocation({ latitude: gemAt(0).lat, longitude: gemAt(0).lng, accuracy: 6 });
  await page.getByRole("button", { name: /saved photo/ }).click();
  await submitPhoto(page);
  await expect(page.getByRole("heading", { name: "Story Gem!" })).toBeVisible();
});

test("inaccurate GPS asks to improve accuracy instead of accepting", async ({ page, context }) => {
  await grantLocation(context, gemAt(0), 90);
  const calls = await mockVerify(page, () => "pass");
  await startLiveHunt(page);
  await expect(page.getByText(/GPS is fuzzy \(±90 m\)/)).toBeVisible({ timeout: 15_000 });
  await takePhoto(page);
  await submitPhoto(page);
  await expect(page.getByText("Let's fix your location")).toBeVisible();
  await expect(page.getByText(/turn on precise location/)).toBeVisible();
  expect(calls).toEqual([]);
});

test("location permission denied shows recovery steps", async ({ page }) => {
  // No geolocation permission granted in this context.
  await page.goto(BASE);
  await page.getByRole("button", { name: "Start exploring" }).click();
  await page.getByRole("button", { name: "Allow location" }).click();
  await expect(page.getByText("Location isn't available yet")).toBeVisible({ timeout: 25_000 });
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  await page.getByRole("button", { name: "Continue to the map" }).click();
  await expect(page.getByText(/Gem 1 of 2/)).toBeVisible();
});

test("offline submission keeps the photo and succeeds after reconnecting", async ({ page, context }) => {
  await grantLocation(context, gemAt(0));
  await mockVerify(page, () => "pass");
  await startLiveHunt(page);
  await takePhoto(page);
  await context.setOffline(true);
  await submitPhoto(page);
  await expect(page.getByRole("heading", { name: "You're offline" })).toBeVisible();
  await expect(page.getByText(/Your photo is saved on this phone/)).toBeVisible();
  await context.setOffline(false);
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByRole("heading", { name: "Story Gem!" })).toBeVisible();
});

test("verification API failure preserves the photo; retry succeeds once", async ({ page, context }) => {
  await grantLocation(context, gemAt(0));
  const queue: MockVerdict[] = ["provider_error", "network", "pass"];
  const calls = await mockVerify(page, () => queue.shift() ?? "pass");
  await startLiveHunt(page);
  await takePhoto(page);
  await submitPhoto(page);
  await expect(page.getByText("The photo checker didn't answer")).toBeVisible();
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByText("The photo checker didn't answer")).toBeVisible();
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByRole("heading", { name: "Story Gem!" })).toBeVisible();
  expect(calls).toEqual(["provider_error", "network", "pass"]);
});

test("real photo-checker Worker without an API key reports that verification isn't set up", async ({ page, context }) => {
  await grantLocation(context, gemAt(0));
  await startLiveHunt(page); // no mock: hits the real Worker running locally
  await takePhoto(page);
  await submitPhoto(page);
  await expect(page.getByText(/isn't set up yet/)).toBeVisible();
  await expect(page.getByRole("button", { name: "What is Demo Mode?" })).toBeVisible();
  await expect(page.getByRole("button", { name: /0 of 2|Back to map/ }).first()).toBeVisible();
});

test("Demo Mode is explicit, labelled, and kept separate from live progress", async ({ page }) => {
  await page.goto(BASE);
  await page.getByRole("button", { name: "Privacy", exact: true }).click();
  await page.getByRole("button", { name: "Back to menu" }).click();
  await page.getByRole("button", { name: /Demo Mode: off/ }).click();
  await page.getByRole("button", { name: "Turn on Demo Mode" }).click();
  await expect(page.getByText("DEMO MODE · nothing is really verified")).toBeVisible();

  await page.getByRole("button", { name: "Demo controls" }).click();
  await page.getByRole("button", { name: "At checkpoint" }).click();
  await expect(page.getByText("You're here! Take the photo.")).toBeVisible();
  await page.getByRole("button", { name: /^(Open camera|Take photo:)/ }).click();
  await page.getByRole("button", { name: /Demo: use a labelled sample image/ }).click();
  await submitPhoto(page);
  await expect(page.getByText("Simulated result (Demo Mode)")).toBeVisible();
  await expect(page.getByText(/Demo Mode: simulated, not verified/)).toBeVisible();
  await page.getByRole("button", { name: "Reveal the next clue" }).click({ timeout: 10_000 });
  await expect(page.getByRole("button", { name: /1 of 2 gems collected/ })).toBeVisible();

  await page.getByRole("button", { name: "Exit" }).click();
  await expect(page.getByText("DEMO MODE · nothing is really verified")).toHaveCount(0);
  // Live hunt starts at the welcome screen with nothing collected.
  await expect(page.getByRole("button", { name: "Start exploring" })).toBeVisible();
});

test("delete my hunt data requires confirmation and wipes everything", async ({ page, context }) => {
  await grantLocation(context, gemAt(0));
  await mockVerify(page, () => "pass");
  await startLiveHunt(page);
  await takePhoto(page);
  await submitPhoto(page);
  await expect(page.getByRole("heading", { name: "Story Gem!" })).toBeVisible();
  await page.getByRole("button", { name: "Reveal the next clue" }).click({ timeout: 10_000 });
  await page.getByRole("button", { name: "Open menu" }).click();
  await page.getByRole("button", { name: /Delete my hunt data/ }).click();
  await expect(page.getByRole("alertdialog")).toContainText("can't be undone");
  await page.getByRole("button", { name: "Delete everything" }).click();
  await expect(page.getByRole("button", { name: "Start exploring" })).toBeVisible({ timeout: 15_000 });
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });
  test("celebration reveals the story without waiting on animation", async ({ page, context }) => {
    await grantLocation(context, gemAt(0));
    await mockVerify(page, () => "pass");
    await startLiveHunt(page);
    await takePhoto(page);
    await submitPhoto(page);
    await expect(page.getByRole("heading", { name: "You found Bucknell's first library" })).toBeVisible({ timeout: 4_000 });
  });
});
