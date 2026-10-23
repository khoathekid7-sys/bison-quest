# Bison Quest

**Find the campus hiding in plain sight.**

A photo scavenger hunt for Bucknell University, built as a **progressive web app**:
players open a link, add it to their home screen, and use it like a regular app.
They solve a riddle, walk to a real campus spot, photograph it, and collect a gem.
The app checks **both** their location and their photo before unlocking the next clue.
Finishing builds a personal photo album they can save and share.

| # | Gem | Destination | Coordinates |
|---|-----|-------------|-------------|
| 1 | Story Gem | Carnegie Building (Bucknell's original library) | From map data. **131 m / 431 ft from Taylor Hall** (rule: ≤ 500 ft) |
| 2 | Gathering Gem | ELC uphill-entrance patio (Class of 2026 gift) | **Provisional**: confirm on site |

Research and distance evidence: [CHECKPOINTS.md](CHECKPOINTS.md).

## How it's hosted

- **The app** is a static website published free on **GitHub Pages**
  (`https://YOUR-USERNAME.github.io/bison-quest/`). It's installable ("Add to Home Screen")
  and opens offline after the first visit.
- **The photo checker** is one small program on **Cloudflare Workers** (free). GitHub
  Pages can't keep secrets, so the checker holds the Anthropic API key and is the only
  thing that talks to Claude.

👉 **Step-by-step publishing guide: [DEPLOYING.md](DEPLOYING.md)**

## Try it on your computer

1. Install **Node.js** (the "LTS" version) from <https://nodejs.org>.
2. In Terminal, in this folder:

   ```bash
   npm install
   ```

   ```bash
   npm run dev
   ```

3. Open <http://localhost:3000>. You're not on campus, so open **☰ → Demo Mode** to play
   with simulated GPS and photo checks (a striped banner shows it's on).

To test **real** photo checks locally, run the checker too (see DEPLOYING.md,
"Testing on your computer first").

## ⚠️ Still needed before the competition (launch blockers)

1. **Publish it** (DEPLOYING.md) and add your API key to the checker.
2. **Confirm the ELC patio pin on site.** The patio was scheduled for construction in
   summer 2026 and isn't in map data or aerial photos yet. See [CONFIGURING.md](CONFIGURING.md#1-coordinates).
3. **Add real reference photos** for both checkpoints (3–5 each, taken by you).
   See [public/references/README.md](public/references/README.md).
4. **Walk the route with a real iPhone and Android phone** using [TESTING.md](TESTING.md),
   and tune the photo criteria with real photos.
5. **Confirm the patio facts** you can see in person (seat count, ramp).

## Changing clues, hints, photos and coordinates

Everything lives in **one file**: [src/config/hunt.ts](src/config/hunt.ts).
[CONFIGURING.md](CONFIGURING.md) walks through it. After editing, publish the app *and*
the checker (DEPLOYING.md → "Making changes later").

## How it works (short version)

- **Map:** a game-style campus map drawn from OpenStreetMap buildings and paths
  ([public/map/campus-map.json](public/map/campus-map.json)), shown with Leaflet. The current
  destination is a dashed search area that shrinks with each hint. Future destinations
  stay hidden. Distances are labelled *straight-line*, and no route line is drawn.
- **Location check:** browser GPS (Haversine distance). The reading must be under 30 s
  old, accurate to ±35 m, and within the 30 m arrival radius. It's checked on the phone
  and again by the checker when you submit. Browser GPS can be faked by a determined
  person; this is a friendly game, not a security system.
- **Photo check:** the phone shrinks and re-saves the photo (which removes hidden GPS data)
  and rejects blank shots. The checker sends it, plus your reference photos, to Claude
  with explicit criteria and gets back `pass`, `retry` or `uncertain` with a reason and a
  tip. Only a clear, consistent `pass` awards the gem.
- **Saving:** progress and accepted photos are stored on the phone (IndexedDB). Each award
  saves the photo and progress together in one step. A photo that hasn't passed yet is
  kept, so players never lose it to a bad connection.
- **Offline:** a service worker caches the app and map. Exploring works without signal;
  photo checks wait for a connection, with a clear message.
- **Privacy:** no accounts, analytics or public feeds. The checker doesn't store photos.
  ☰ → *Delete my hunt data* erases everything on the phone.

## Useful commands

| Command | What it does |
|---|---|
| `npm run dev` | Run the app at <http://localhost:3000> |
| `npm run checker:dev` | Run the photo checker locally at <http://localhost:8787> |
| `npm run checker:deploy` | Publish the photo checker to Cloudflare |
| `npm test` | Unit tests (logic, storage, checker) |
| `npm run test:e2e` | Browser tests in Chromium and WebKit on the real static build + local checker (first time: `npx playwright install chromium webkit`) |
| `npm run check` | Type check + lint + unit tests + build |

Next.js collects anonymous usage stats from its developer tools (not from players).
To turn that off: `npx next telemetry disable`.

## Project layout

```
src/config/hunt.ts               ← the hunt: coordinates, clues, hints, photo rules, discoveries
src/components/…                 ← screens, map, art
src/lib/geo.ts                   ← distance, geofence, 500 ft rule, search zones
src/lib/submission.ts            ← one submission end to end (no double awards)
src/lib/storage.ts               ← IndexedDB (separate live and demo databases)
src/lib/verify-core.ts           ← photo-check rules + Claude prompt (used by the checker)
worker/index.ts                  ← the Cloudflare Worker photo checker
wrangler.jsonc                   ← checker settings (your site address goes here)
public/sw.js, src/app/manifest.ts← offline support + home-screen install
public/references/               ← your real reference photos
.github/workflows/deploy-pages.yml ← publishes to GitHub Pages on every push
tests/ and e2e/                  ← automated tests
```

Map data © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors.
The bison mascot, gems, icons and app icon are original artwork made for this project.
