# Checkpoint research and evidence

Researched 23 October 2026. **Verified** means confirmed from a named source.
**Assumption** means an inference that still needs confirming on campus.

## Summary

| | Taylor Hall reference | Gem 1: Carnegie Building | Gem 2: ELC uphill patio |
|---|---|---|---|
| Coordinates | 40.957211, −76.882897 | 40.956285, −76.881928 | 40.95652, −76.88385 |
| Source | OSM building way 512962462 (area-weighted footprint centroid, computed) | OSM node 13661960838 (`entrance=yes`, `wheelchair=yes`) on building way 264223440 | Inferred (see below) |
| Status | Map data | Map data, not yet field-verified | **Provisional: launch blocker** |

## First-checkpoint distance rule (≤ 500 ft / 152.4 m of Taylor Hall)

**Result: Carnegie qualifies. It's the first gem.**

Straight-line (great-circle, Haversine, R = 6,371,008.8 m) distances to the Carnegie checkpoint pin:

| Measured from | Distance | Within 152.4 m? |
|---|---|---|
| Taylor Hall footprint centroid (the reference the app uses) | **131.2 m (430.6 ft)** | ✅ yes, 21 m margin |
| Nearest corner of Taylor Hall's footprint | 107.5 m (353 ft) | ✅ yes |
| Farthest corner of Taylor Hall's footprint | 152.7 m (501 ft) | ⚠️ borderline (not a sensible reference) |

**Straight-line vs walking distance:** these are straight-line distances. The walking
route along campus paths is longer. The app labels every distance as "straight-line".

**Where the player stands:** players may submit from anywhere within 30 m of the pin.
The far (south-east) edge of that circle is about 161 m from Taylor's centroid. To keep
every accepted gem-1 photo within 500 ft of Taylor Hall, gem 1 has
`enforcePlacementRule: true`: the location check also requires the player to be within
152.4 m of the Taylor reference. Players approaching from Taylor Hall are unaffected.

The app recomputes this in ☰ → *Setup status*, and `npm test` fails if a config change breaks it.

## Carnegie Building facts (verified)

From the Bucknell Course Catalog, *Campus Facilities*
(<https://coursecatalog.bucknell.edu/academicsupportcampuslife/campusfacilities/>):

- Constructed in 1905 under a grant from Andrew Carnegie.
- Originally served as the library of the University.
- Major renovation in 2015. Now houses the Teaching & Learning Center, the Writing
  Center and other academic support offices.

The same page confirms Taylor Hall (1849) was the first building on College Hill.

**Checkpoint choice:** OpenStreetMap marks a wheelchair-accessible entrance on the
north-west corner of the Carnegie footprint, the side facing Taylor Hall. It's on an
outdoor path, so building hours don't matter. *Assumption:* the entrance and a good
part of the facade are visible from the path within 30 m. Confirm on site.

**Not verified (so not used):** architectural details such as columns, inscriptions or
materials. No openly licensed photo clearly labelled "Carnegie Building, Bucknell" was
found on Wikimedia Commons, so **no reference photo is included**. You need to add your own.

## ELC uphill-entrance patio

**Verified** (Bucknell News, *Class of 2026 leaves its mark…*, May 2026,
<https://www.bucknell.edu/news/class-2026-leaves-its-mark-new-elc-patio-gathering-space>):

- The patio is at the Elaine Langone Center's **uphill entrance**.
- About 3,600 sq ft, with ramp access and seating for 16; part of an "uphill entrance
  project" with new landscaping and pathways **from Dent Drive** to the ELC.
- Funded through the Class of 2026 Senior Tribute; construction planned after
  Commencement (17 May 2026), completion expected by mid-August 2026.

Also: *Bucknell student experience enhanced through campus upgrades*
(<https://www.bucknell.edu/news/bucknell-student-experience-enhanced-through-campus-upgrades>)
mentions a redesigned uphill plaza and entrance, an accessibility ramp and a small
seating area. It also mentions a **different** "former patio adjacent to Bostwick" that
was enclosed. That is *not* our checkpoint.

**Assumptions (why the pin is where it is):**

1. *Which side is "uphill":* USGS spot elevations in OpenStreetMap show campus rising
   to the east (e.g. 159 m near the Computer Center vs 142 m at Sojka Pavilion to the west).
2. *Dent Drive:* OpenStreetMap way 12056815 (Dent Drive) runs along the **east** face of
   the ELC footprint (way 31665655). This matches the article's "pathways from Dent Drive".
3. So the pin sits just east of the ELC's east facade, about 8 m out. The 2026 patio
   isn't in OpenStreetMap or the available aerial imagery yet, so **the exact patio
   location is unconfirmed**.

**To do on site:** stand at the middle of the patio, record coordinates (see
CONFIGURING.md), take reference photos, count the seats, and change `status` to
`"field-verified"`.

The ELC is ~112 m from Taylor Hall. It would also satisfy the 500 ft rule, so either
gem could go first if needed.

## Not added

No extra destinations were added. Both required gems fit the rule, so no starter
checkpoint was needed.
