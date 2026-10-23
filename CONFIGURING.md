# Configuring the hunt

Everything is in **[src/config/hunt.ts](src/config/hunt.ts)**. Open it in any code
editor (VS Code is free). Each gem is one block inside `gems: [ … ]`, in play order.

After editing, save the file. If `npm run dev` is running, the app reloads by itself.
To publish your changes, see [DEPLOYING.md](DEPLOYING.md#making-changes-later).
Run `npm test` afterwards: it checks the 500 ft rule and the hunt order for you.

---

## 1. Coordinates

```ts
checkpoint: {
  lat: 40.95652,
  lng: -76.88385,
  status: "provisional",   // "provisional" → "map-data" → "field-verified"
  source: "…where the numbers came from…",
},
arrivalRadiusMeters: 30,
```

**How to get exact coordinates on site (iPhone or Android):**

1. Stand where you want players to stand when they take the photo (outdoors, public).
2. Open Google Maps and press and hold on the blue dot (or your exact spot) until a red pin drops.
3. The coordinates appear at the top or bottom (for example `40.95652, -76.88385`).
   Tap them to copy. The first number is `lat`, the second is `lng`.
4. Paste them into `hunt.ts` and change `status` to `"field-verified"`. Add a short note
   to `source`, e.g. `"Measured on site with Google Maps, 24 Oct 2026"`.

Take 2–3 readings a minute apart and use the middle one. GPS can drift.

**Arrival radius (`arrivalRadiusMeters`)**: how close a player must be.

- *Smaller (20 m):* stricter, but phones next to buildings often report ±10–20 m
  error, so honest players may get "not quite there".
- *Larger (40 m):* more forgiving, but a player could submit from farther away.
- 30 m is a good starting point. Test it on campus.

GPS quality rules apply to all gems (`gps:` near the top):
`maxAccuracyMeters: 35` (a fuzzier fix gets "Improve location accuracy") and
`maxFixAgeMs: 30000` (readings older than 30 s are refused).

**The 500 ft rule** (`placementRule`) is separate from the arrival radius. It's
measured from Taylor Hall's reference point to the **first** gem's checkpoint.
`npm test` fails if the first gem moves beyond 152.4 m. Gem 1 also has
`enforcePlacementRule: true`, so players must be within 500 ft of Taylor Hall
when they submit, not just within 30 m of the pin.

## 2. Clues and hints

```ts
clue: [
  "Before your stories lived on a screen,",
  "I kept the pages in between.",
  …
],
hints: [
  "Hint 1: a nudge that doesn't name the place.",
  "Hint 2: names the place and says exactly what to photograph.",
],
```

Each clue line is one line on screen. Keep lines under ~42 characters so they
don't wrap on small phones. The player sees Hint 1 first; Hint 2 should name the
destination and give clear photo directions.

## 3. Photo target and verification criteria

```ts
photo: {
  instruction: "Photograph … from outside: get … in the frame.",  // shown on the camera
  mustInclude: ["…", "…"],          // ALL must be visible to pass
  tolerate: ["different angles", …], // differences that are fine
  rejectIf: ["a selfie …", …],       // automatic retry
  confirmedVisualTraits: [],         // things YOU have seen in person
  referenceImages: [],               // your real photos (see below)
  requireReferenceImages: false,     // set true before launch
},
```

**Tuning with real photos:** take 10–15 test photos at the spot (good, bad, far,
night, partly blocked). Submit them with the app's Setup status showing the API key
is set (☰ → Setup status). If good photos get "retry" or "uncertain", loosen `mustInclude` or add to
`tolerate`. If wrong places pass, add a precise `confirmedVisualTraits` entry
(e.g. *"name carved in stone above the door"*, but only if you've seen it) and add
more reference photos.

**Only write what's really there.** Never add invented details to
`confirmedVisualTraits`. The checker will look for them.

## 4. Reference photos

1. Take 3–5 photos of the checkpoint yourself, from where players will stand:
   different angles, and if you can, different times of day.
2. Save them as JPEGs (`.jpg`) in `public/references/<gem-id>/`, for example
   `public/references/carnegie/front-1.jpg`.
3. List each one in `referenceImages`:

```ts
referenceImages: [
  { src: "/references/carnegie/front-1.jpg", credit: "Your Name, Oct 2026",
    description: "Northwest entrance and facade from the path" },
],
```

4. Once each gem has references, set `requireReferenceImages: true`.

Publishing shrinks the photos automatically (`scripts/prepare-references.mjs`), so full-size
phone photos are fine. iPhone tip: if your photos save as HEIC, set
Settings → Camera → Formats → **Most Compatible**, or export them as JPEG.

Use only photos you took or have permission to use. Never use AI-generated or
stock images: the checker compares players' photos against these.

## 5. Discovery text

```ts
discovery: {
  title: "You found Bucknell's first library",
  body: "…facts with a source…",
  noticeThis: "…the thing to look for next time…",
  albumCaption: "…one line for the album…",
  source: [{ label: "…", url: "https://…" }],
},
```

Every fact needs a source link. Shown on the discovery card.

## 6. Adding a third gem (later)

Copy a whole gem block, give it a new `id`, `gemName`, `color`, coordinates, clue,
hints, photo criteria and discovery, and paste it at the end of `gems`. The map,
progress bar and album adjust automatically. Changing the number or order of gems
can make saved progress invalid, so also increase `version` at the top of the hunt.

## 7. API credentials and model

The API key lives only in the **photo checker** (Cloudflare Worker), never in the website.

| Setting | Where | Meaning |
|---|---|---|
| `ANTHROPIC_API_KEY` | `npx wrangler secret put ANTHROPIC_API_KEY` (locally: `.dev.vars`) | Your key. Secret. |
| `BISON_VISION_MODEL` | `vars` in `wrangler.jsonc` | Default `claude-opus-5-5`. Any current Claude model that accepts images. |
| `BISON_VISION_EFFORT` | `vars` in `wrangler.jsonc` | `low`, `medium` (default) or `high`. |
| `ALLOWED_ORIGINS`, `SITE_URL` | `vars` in `wrangler.jsonc` | Your GitHub Pages address (see DEPLOYING.md). |
| `VERIFY_URL` | GitHub repo → Settings → Secrets and variables → Actions → Variables | The checker's address, built into the app. |

After changing `wrangler.jsonc`, run `npx wrangler deploy`.

**Remember:** the checker re-checks location using `src/config/hunt.ts` too, so after
editing coordinates, publish both the app and the checker (DEPLOYING.md → "Making changes later").
