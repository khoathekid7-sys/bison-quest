/**
 * ============================================================================
 *  BISON QUEST — HUNT CONFIGURATION (the one file you edit)
 * ============================================================================
 *
 *  Everything about the hunt lives here: coordinates, clues, hints, photo
 *  targets, reference images, verification criteria, geofence radius, and
 *  discovery text. See CONFIGURING.md for a plain-English walkthrough.
 *
 *  HONESTY RULES FOR EDITORS
 *  - Only state facts you can source. Put the source URL in `discovery.source`.
 *  - Mark coordinates `status: "provisional"` until someone has stood on the
 *    spot with a phone and confirmed it. The app shows a setup warning for any
 *    provisional checkpoint and the README lists it as a launch blocker.
 *  - Reference images must be real photos of the real place. Never add stock
 *    or AI images here. Leave the array empty rather than guess.
 */

export type LatLng = { lat: number; lng: number };

export type CoordinateStatus =
  /** Taken from map data (e.g. OpenStreetMap) but not yet confirmed on site. */
  | "map-data"
  /** Confirmed by standing at the spot with a phone. */
  | "field-verified"
  /** Best guess. Must be confirmed before launch. */
  | "provisional";

export type ReferenceImage = {
  /** Path under /public, e.g. "/references/carnegie/front-1.jpg". */
  src: string;
  /** Who took it, and when (e.g. "Khoa L., Oct 2026"). */
  credit: string;
  /** What the photo shows — helps the verifier and future editors. */
  description: string;
};

export type GemConfig = {
  id: string;
  /** Collectible name shown in the UI. */
  gemName: string;
  /** Real destination name — hidden from the player until hint 2 or collection. */
  destinationName: string;
  /** Accent colour for this gem (CSS colour). */
  color: string;
  checkpoint: LatLng & {
    status: CoordinateStatus;
    /** Where the coordinates came from. */
    source: string;
    notes?: string;
  };
  /** Gameplay arrival radius in metres (separate from the 500 ft placement rule). */
  arrivalRadiusMeters: number;
  /**
   * If true, the player must ALSO be within placementRule.maxDistanceMeters of
   * the placement reference (Taylor Hall) when the location is checked. This
   * guarantees every accepted photo for this gem is taken within 500 ft of
   * Taylor Hall, even at the far edge of the arrival radius.
   */
  enforcePlacementRule?: boolean;
  clue: string[];
  hints: [string, string];
  photo: {
    /** One-line instruction shown on the camera screen. */
    instruction: string;
    /** Things that MUST be visible for a pass. */
    mustInclude: string[];
    /** Variations the verifier should tolerate. */
    tolerate: string[];
    /** Things that must cause a retry. */
    rejectIf: string[];
    /**
     * Optional distinctive visual traits of the real place, written by someone
     * who has seen it in person (e.g. "arched entrance with stone steps").
     * Leave empty until confirmed — the verifier then relies on references.
     */
    confirmedVisualTraits: string[];
    referenceImages: ReferenceImage[];
    /**
     * If true, live verification refuses to pass this gem until at least one
     * reference image is configured. Recommended for the competition.
     */
    requireReferenceImages: boolean;
  };
  discovery: {
    title: string;
    body: string;
    /** "Next time you walk by…" prompt — the thing to notice. */
    noticeThis: string;
    /** Short caption used in the album. */
    albumCaption: string;
    source: { label: string; url: string }[];
  };
};

export type HuntConfig = {
  id: string;
  version: number;
  title: string;
  tagline: string;
  theme: string;
  /** Competition rule: first photo checkpoint within 500 ft of Taylor Hall. */
  placementRule: {
    referenceName: string;
    reference: LatLng;
    referenceSource: string;
    maxDistanceMeters: number;
  };
  /** GPS quality rules applied to every check. */
  gps: {
    /** Reject fixes whose reported accuracy (± metres) is worse than this. */
    maxAccuracyMeters: number;
    /** Reject fixes older than this. */
    maxFixAgeMs: number;
  };
  /** Starting map view. */
  mapCenter: LatLng;
  gems: GemConfig[];
};

export const HUNT: HuntConfig = {
  id: "bison-quest-stories",
  version: 1,
  title: "Bison Quest",
  tagline: "Find the campus hiding in plain sight.",
  theme: "Places that connect Bucknell's stories and people",

  placementRule: {
    referenceName: "Taylor Hall",
    // Area-weighted centroid of the Taylor Hall building footprint,
    // OpenStreetMap way 512962462 (retrieved 2026-10-23).
    reference: { lat: 40.957211, lng: -76.882897 },
    referenceSource: "OpenStreetMap way 512962462 (building footprint centroid)",
    maxDistanceMeters: 152.4, // 500 feet
  },

  gps: {
    maxAccuracyMeters: 35,
    maxFixAgeMs: 30_000,
  },

  mapCenter: { lat: 40.9566, lng: -76.8830 },

  gems: [
    // ------------------------------------------------------------------------
    // GEM 1 — Carnegie Building
    // ------------------------------------------------------------------------
    {
      id: "carnegie",
      gemName: "Story Gem",
      destinationName: "Carnegie Building",
      color: "#F28C28",
      checkpoint: {
        // OSM node 13661960838: entrance=yes, wheelchair=yes, on the Carnegie
        // Building footprint (way 264223440), northwest corner — the side
        // facing Taylor Hall. Retrieved 2026-10-23.
        lat: 40.956285,
        lng: -76.881928,
        status: "map-data",
        source: "OpenStreetMap node 13661960838 (Carnegie Building entrance)",
        notes:
          "Outdoor, publicly accessible approach path. Confirm on site that the " +
          "entrance and facade are visible from within the arrival radius.",
      },
      arrivalRadiusMeters: 30,
      // The far (east) edge of a 30 m circle reaches ~161 m from Taylor's
      // centroid, so also require the player to be within 152.4 m of Taylor.
      enforcePlacementRule: true,
      clue: [
        "Before your stories lived on a screen,",
        "I kept the pages in between.",
        "A gift from 1905, still here today\u00a0—",
        "find where borrowed stories used to stay.",
      ],
      hints: [
        "This building is named for the industrialist whose grants paid for libraries all over America. It's a short walk southeast of Taylor Hall.",
        "It's the Carnegie Building, about 130 m southeast of Taylor Hall. Stand outside and photograph its entrance with a good part of the front wall in the frame.",
      ],
      photo: {
        instruction:
          "Photograph the Carnegie Building from outside: get an entrance and a good part of the facade in the frame.",
        mustInclude: [
          "the exterior of the Carnegie Building",
          "a building entrance (door or doorway)",
          "a substantial part of the building's facade, not just a close-up of a wall or door",
        ],
        tolerate: [
          "different viewing angles and distances",
          "day, dusk, cloudy, rain or snow lighting",
          "seasonal changes: bare trees, leaves, snow",
          "people, bikes or vehicles partially in front of the building",
          "slight blur or tilt",
        ],
        rejectIf: [
          "the photo is a selfie or a person fills most of the frame",
          "the photo is of an interior",
          "the building is not the Carnegie Building, or cannot be identified",
          "the photo is a generic campus scene without a clear building entrance",
          "the image is blank, black, extremely blurry or a screen/photo-of-a-photo",
        ],
        confirmedVisualTraits: [
          // TODO(organizer): after visiting, add 2–4 distinctive traits you have
          // seen yourself, e.g. "name carved above the door". Do not guess.
        ],
        referenceImages: [
          // TODO(organizer): add 3–5 real photos taken on site. See
          // public/references/README.md. Example:
          // { src: "/references/carnegie/front-1.jpg", credit: "Your name, Oct 2026",
          //   description: "Northwest entrance and facade from the path" },
        ],
        requireReferenceImages: false,
      },
      discovery: {
        title: "You found Bucknell's first library",
        body:
          "The Carnegie Building was built in 1905 with a grant from Andrew Carnegie and originally served as the University's library. " +
          "After a major renovation in 2015 it houses the Teaching & Learning Center and the Writing Center. It's still a building about stories: it used to lend them, and now it helps people write them.",
        noticeThis:
          "Next time you pass, picture this building full of library shelves, and then think of the essays being drafted inside it now.",
        albumCaption: "Built in 1905 as Bucknell's library. Today it's home to the Writing Center.",
        source: [
          {
            label: "Bucknell Course Catalog — Campus Facilities",
            url: "https://coursecatalog.bucknell.edu/academicsupportcampuslife/campusfacilities/",
          },
        ],
      },
    },

    // ------------------------------------------------------------------------
    // GEM 2 — ELC uphill-entrance patio (PROVISIONAL PIN)
    // ------------------------------------------------------------------------
    {
      id: "elc-patio",
      gemName: "Gathering Gem",
      destinationName: "ELC Uphill Patio",
      color: "#2EC4B6",
      checkpoint: {
        // PROVISIONAL. Bucknell News (May 2026) places the Class of 2026 patio at
        // the ELC's "uphill entrance", with new pathways from Dent Drive.
        // OpenStreetMap shows Dent Drive running along the ELC's EAST face
        // (way 12056815), and USGS elevations show campus rising to the east.
        // So the pin is just east of the ELC's east facade (way 31665655).
        // The patio was built in summer 2026 and is not in map data or aerial
        // imagery yet. CONFIRM ON SITE and move this pin onto the patio itself.
        lat: 40.95652,
        lng: -76.88385,
        status: "provisional",
        source:
          "Inferred from Bucknell News (uphill entrance, Dent Drive) + OSM ELC footprint way 31665655 and Dent Drive way 12056815",
        notes: "Move the pin to the centre of the new patio once confirmed in person.",
      },
      arrivalRadiusMeters: 30,
      clue: [
        "Where campus conversations step outside,",
        "find a pause along the uphill side.",
        "No classroom walls, yet stories meet —",
        "a graduating class saved you a seat.",
      ],
      hints: [
        "Go to the building where students pick up mail, grab food and meet friends. Then find its uphill entrance.",
        "It's the new patio at the Elaine Langone Center's uphill entrance, on the Dent Drive side. Photograph the patio seating with the ELC entrance or wall behind it.",
      ],
      photo: {
        instruction:
          "Photograph the patio from outside: get the seating and the ELC entrance or wall behind it in the frame.",
        mustInclude: [
          "an outdoor paved patio or plaza",
          "outdoor seating on or beside the patio",
          "the adjoining building (the Elaine Langone Center), showing an entrance or wall",
        ],
        tolerate: [
          "different viewing angles",
          "people sitting on or walking across the patio",
          "day, night, rain or snow lighting; snow on the seating",
          "partial obstruction by trees, signs or people",
        ],
        rejectIf: [
          "the photo is a selfie or a person fills most of the frame",
          "the photo is of an interior",
          "there is no visible outdoor seating",
          "the photo shows a different place, such as a generic lawn or parking lot",
          "the image is blank, black, extremely blurry or a screen/photo-of-a-photo",
        ],
        confirmedVisualTraits: [
          // TODO(organizer): add traits you have seen in person, e.g. seat style or
          // the ramp. Per Bucknell News the patio is ~3,600 sq ft with ramp access
          // and seating for 16, but confirm what was actually built.
        ],
        referenceImages: [
          // TODO(organizer): add 3–5 real on-site photos of the finished patio.
        ],
        requireReferenceImages: false,
      },
      discovery: {
        title: "A seat the Class of 2026 left for you",
        body:
          "Bucknell News reported in May 2026 that this patio at the ELC's uphill entrance would be built that summer: about 3,600 square feet with ramp access. " +
          "Its outdoor seating was funded by the Class of 2026 Senior Tribute. From several options, the seniors picked a gathering space that is “well-utilized and highly visible”.",
        noticeThis:
          "The plan called for seating for 16 people. Count the seats around you: did it turn out that way? A graduating class picked this spot so people could see each other during the day.",
        albumCaption: "A gathering place funded by the Class of 2026 Senior Tribute.",
        source: [
          {
            label: "Bucknell News — Class of 2026 leaves its mark (May 2026)",
            url: "https://www.bucknell.edu/news/class-2026-leaves-its-mark-new-elc-patio-gathering-space",
          },
          {
            label: "Bucknell News — Campus upgrades (uphill plaza and entrance)",
            url: "https://www.bucknell.edu/news/bucknell-student-experience-enhanced-through-campus-upgrades",
          },
        ],
      },
    },
  ],
};
