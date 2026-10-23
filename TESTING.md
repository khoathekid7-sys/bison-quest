# Testing

## Automated tests

```bash
npm test             # unit tests (Vitest)
npm run build        # production build
npm run test:e2e     # browser tests (Playwright) against the production build
```

### Unit tests: `tests/` (75 tests)

| Area | What's covered |
|---|---|
| Distance + 500 ft rule | Haversine accuracy; Carnegie checkpoint 131 m from Taylor (passes); moving it past 152.4 m fails; boundary at exactly 152.4 m; rule independent of arrival radius; gem 1 rejects the far side of its circle that's > 500 ft from Taylor |
| Geofence | in range / out of range / low accuracy / stale / unavailable |
| Ordered progression | first gem active, rest locked; unlock exactly once; out-of-order, duplicate and unknown-gem awards rejected |
| Storage (IndexedDB) | photo + progress committed together; refresh restores progress and photos; duplicate commit writes nothing; live and demo kept separate; delete wipes everything |
| Submission flow | valid location + valid photo → gem; wrong photo at the right place → no gem, photo kept; right photo outside geofence → no gem, photo never sent; uncertain → no gem; a "pass" without server approval isn't trusted; concurrent duplicate submits → one award; API failure keeps the pending photo and retry succeeds; offline; storage failure reported honestly |
| Photo checker | pass needs every signal to agree; selfie / wrong place / generic scene / blank never pass; missing references can block a pass; prompt guards against instructions written inside images; real file type detected from bytes; tiny and non-image uploads rejected; refusals become "uncertain"; gem 1's 500 ft rule enforced on the checker too; blank photos stopped on the phone before upload |
| Cloudflare Worker | CORS only for your site; requests from other sites refused; `not_configured` without the API key; status report never leaks the key; reference photos loaded from the published site |

### Browser tests: `e2e/` (15 scenarios × 4 setups)

Run in **Chromium** (Android Chrome engine) and **WebKit** (iPhone Safari engine), each
at **375 px** and **430 px** phone widths, with touch enabled, against the **same static
build GitHub Pages serves** (under `/bison-quest/`). The real photo-checker Worker runs
locally in Cloudflare's runtime with no API key. Most tests mock its answers at the network
level (the geofence logic is still the real code); one test talks to the real Worker.

- Complete journey: welcome → permissions → map → hints → walk → photo → both checks →
  collect + discovery → refresh mid-celebration → gem 2 → album → refresh → single photo
  download → combined album export → reset with confirmation
- Wrong photo → actionable feedback → retake → uncertain → no gem → saved photo resubmitted
- Right photo, wrong place → location fails, photo not sent → walk closer → retry without retaking
- Inaccurate GPS (±90 m) → "improve accuracy", never accepted
- Location permission denied → recovery steps
- Offline submission → photo kept → reconnect → success
- API failure (502 and network drop) → photo kept → retry succeeds once
- Real Worker, no API key → clear "not set up" message
- PWA: manifest valid, icons load, home-screen metadata present; opens offline after the
  first visit (service worker); "Add to Home Screen" help for iPhone and Android
- Demo Mode → explicit opt-in, striped banner, "simulated" labels, separate progress
- Delete my hunt data → confirmation → everything gone
- Reduced motion → celebration doesn't wait on animation
- In-app rear camera (Chromium synthetic camera): capture works, and every camera track
  stops when the camera closes or a photo is taken
- Layout checks: no horizontal scrolling; every button on the map screen is ≥ 44 × 44 px

**Last run (23 Oct 2026):** 75/75 unit tests passed. 112 browser runs passed (the suite
repeated 2× to catch flaky tests). 8 skipped, all in WebKit: it has no synthetic camera
(so WebKit tests use the "choose a photo" fallback) and Playwright can't test offline
service workers there.

## What the simulations can't prove

Everything above ran in desktop browser engines with simulated GPS and a mocked photo
checker. It has **not** been tested on:

- a physical iPhone or Android phone,
- real campus GPS (accuracy next to buildings, drift, standing still),
- a real phone camera, or HEIC photos from the iPhone photo library,
- the live Claude API (no API key was available while building), including real
  pass/retry rates on actual Carnegie and patio photos,
- the real GitHub Pages and Cloudflare deployment (the same files were tested locally),
- "Add to Home Screen" on a real iPhone and Android phone,
- real network conditions on campus Wi-Fi or cellular.

## Real-phone checklist (do this on campus)

Use the published GitHub Pages link (see DEPLOYING.md). Do it once on **iPhone Safari**
and once on **Android Chrome**.

**Setup**
- [ ] ☰ → Setup status shows "API key set", the first-checkpoint rule passes, and both
      gems have reference photos
- [ ] ELC patio coordinates updated and marked `field-verified`

**Install**
- [ ] ☰ → Add to Home Screen: follow the steps; the Bison Quest icon appears
- [ ] Opening the icon shows the app full-screen (no browser address bar)

**First run** (from the home-screen icon)
- [ ] Welcome screen looks right; nothing hidden by the notch or home bar
- [ ] "Allow location" shows the system prompt; allow it (Precise Location on)
- [ ] On the map, your blue dot appears within a few seconds near where you are

**Gem 1: Carnegie** (start at Taylor Hall)
- [ ] Distance reads "Getting warmer · ≈ 130 m … straight-line"
- [ ] Hints 1 and 2 appear; Hint 2 names Carnegie
- [ ] Walk to the north-west entrance. "You're here!" appears, and "Take photo" turns orange
- [ ] Wait still for 30 s: the status stays "You're here" (doesn't go stale)
- [ ] The in-app camera opens with the **rear** camera; take a good photo → both checks pass
- [ ] Also try: a selfie, a photo of the ground, and a photo of a different building.
      Each should get "retry" with a useful tip
- [ ] Try from the far (south-east) side of the building: you should be asked to stand on
      the Taylor Hall side
- [ ] Discovery card appears with the source link; "Reveal the next clue" works

**Gem 2: ELC patio**
- [ ] Search circle covers the real patio; "You're here!" triggers on the patio itself
- [ ] Photo of the seating + ELC wall passes; a photo of the lawn doesn't
- [ ] Count the seats and check the discovery text is accurate

**Recovery**
- [ ] Turn on Airplane Mode, close and reopen the app → it still opens and shows the map
- [ ] Turn on Airplane Mode, submit → "You're offline" → turn it off → Try again → works
- [ ] Deny camera permission (browser settings) → "Open phone camera" fallback works
- [ ] iPhone: choose a photo from the library (HEIC) → it uploads and is checked
- [ ] Close the browser mid-hunt, reopen → progress and photos are still there
- [ ] Album: Save one photo; Share album opens the share sheet (or downloads)
- [ ] ☰ → Delete my hunt data → confirm → back to the welcome screen

**Tuning notes to record:** typical GPS accuracy at each spot (±m), how many good photos
failed, and how long verification took. Adjust `arrivalRadiusMeters` and the photo
criteria in `src/config/hunt.ts` (see CONFIGURING.md).
