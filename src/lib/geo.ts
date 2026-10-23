import type { GemConfig, HuntConfig, LatLng } from "@/config/hunt";

/** Mean Earth radius (IUGG), metres. */
const EARTH_RADIUS_M = 6_371_008.8;
export const METERS_PER_FOOT = 0.3048;

const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle (straight-line) distance in metres, Haversine formula. */
export function haversineMeters(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Initial bearing from a to b in degrees (0 = north, 90 = east). */
export function bearingDegrees(a: LatLng, b: LatLng): number {
  const y = Math.sin(toRad(b.lng - a.lng)) * Math.cos(toRad(b.lat));
  const x =
    Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) -
    Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(toRad(b.lng - a.lng));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/** Point offset from origin by distance (m) on a bearing (deg). Good for short distances. */
export function offsetPoint(origin: LatLng, meters: number, bearingDeg: number): LatLng {
  const d = meters / EARTH_RADIUS_M;
  const br = toRad(bearingDeg);
  const lat1 = toRad(origin.lat);
  const lng1 = toRad(origin.lng);
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(br));
  const lng2 =
    lng1 + Math.atan2(Math.sin(br) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2));
  return { lat: (lat2 * 180) / Math.PI, lng: (lng2 * 180) / Math.PI };
}

export const metersToFeet = (m: number) => m / METERS_PER_FOOT;

/** "≈ 130 m (430 ft)" — rounded so it never implies false precision. */
export function formatApproxDistance(meters: number): string {
  if (meters < 10) return "less than 10 m";
  const m = meters < 100 ? Math.round(meters / 5) * 5 : Math.round(meters / 10) * 10;
  const ft = Math.round(metersToFeet(m) / 10) * 10;
  return `≈ ${m} m (${ft} ft)`;
}

// --------------------------------------------------------------------------
// Location checks
// --------------------------------------------------------------------------

export type GeoFix = {
  lat: number;
  lng: number;
  /** Reported horizontal accuracy radius in metres (68% confidence). */
  accuracy: number;
  /** Epoch ms when the fix was taken. */
  timestamp: number;
};

export type LocationStatus = "in_range" | "out_of_range" | "low_accuracy" | "stale" | "unavailable";

export type LocationCheck = {
  status: LocationStatus;
  passed: boolean;
  distanceMeters: number | null;
  accuracyMeters: number | null;
  radiusMeters: number;
  message: string;
};

/**
 * Decide whether a GPS fix puts the player at the gem.
 *
 * Rules, in order:
 * 1. No fix → unavailable.
 * 2. Fix older than gps.maxFixAgeMs → stale (never accept old positions).
 * 3. Reported accuracy worse than gps.maxAccuracyMeters → low_accuracy. We do
 *    not "give the benefit of the doubt" to a fuzzy fix.
 * 4. Distance to checkpoint ≤ arrival radius → in_range, otherwise out_of_range.
 * 5. If the gem enforces the placement rule, the player must also be within
 *    the rule's distance of the placement reference (e.g. 500 ft of Taylor).
 */
export function evaluateFix(
  fix: GeoFix | null,
  gem: Pick<GemConfig, "checkpoint" | "arrivalRadiusMeters" | "enforcePlacementRule">,
  gps: HuntConfig["gps"],
  nowMs: number,
  placement?: HuntConfig["placementRule"],
): LocationCheck {
  const radius = gem.arrivalRadiusMeters;
  if (!fix || !Number.isFinite(fix.lat) || !Number.isFinite(fix.lng)) {
    return {
      status: "unavailable",
      passed: false,
      distanceMeters: null,
      accuracyMeters: null,
      radiusMeters: radius,
      message: "We couldn't get your location. Check that location access is on, then try again.",
    };
  }
  const distance = haversineMeters(fix, gem.checkpoint);
  const age = nowMs - fix.timestamp;
  if (age > gps.maxFixAgeMs) {
    return {
      status: "stale",
      passed: false,
      distanceMeters: distance,
      accuracyMeters: fix.accuracy,
      radiusMeters: radius,
      message: "Your location reading is out of date. Hold your phone still outdoors for a few seconds and try again.",
    };
  }
  if (!Number.isFinite(fix.accuracy) || fix.accuracy > gps.maxAccuracyMeters) {
    return {
      status: "low_accuracy",
      passed: false,
      distanceMeters: distance,
      accuracyMeters: fix.accuracy,
      radiusMeters: radius,
      message: `GPS is too fuzzy right now (±${Math.round(fix.accuracy)} m; we need ±${gps.maxAccuracyMeters} m or better). Step away from walls, turn on precise location, and wait a moment.`,
    };
  }
  if (distance <= radius && gem.enforcePlacementRule && placement) {
    const fromRef = haversineMeters(fix, placement.reference);
    if (fromRef > placement.maxDistanceMeters) {
      return {
        status: "out_of_range",
        passed: false,
        distanceMeters: distance,
        accuracyMeters: fix.accuracy,
        radiusMeters: radius,
        message: `So close! For this checkpoint, stand on the ${placement.referenceName} side of the building (within 500 ft of ${placement.referenceName}) and try again. Your photo is saved.`,
      };
    }
  }
  if (distance <= radius) {
    return {
      status: "in_range",
      passed: true,
      distanceMeters: distance,
      accuracyMeters: fix.accuracy,
      radiusMeters: radius,
      message: "You're at the checkpoint.",
    };
  }
  return {
    status: "out_of_range",
    passed: false,
    distanceMeters: distance,
    accuracyMeters: fix.accuracy,
    radiusMeters: radius,
    message: `Not quite there: you're ${formatApproxDistance(distance)} away in a straight line. Get within ${radius} m and try again. Your photo is saved.`,
  };
}

// --------------------------------------------------------------------------
// Competition placement rule (separate from gameplay radius)
// --------------------------------------------------------------------------

export type PlacementResult = {
  gemId: string;
  referenceName: string;
  distanceMeters: number;
  distanceFeet: number;
  limitMeters: number;
  limitFeet: number;
  passes: boolean;
  checkpointStatus: GemConfig["checkpoint"]["status"];
};

/** Straight-line distance from the placement reference to the FIRST gem's checkpoint. */
export function checkPlacementRule(hunt: HuntConfig): PlacementResult {
  const first = hunt.gems[0];
  if (!first) throw new Error("Hunt has no gems");
  const d = haversineMeters(hunt.placementRule.reference, first.checkpoint);
  return {
    gemId: first.id,
    referenceName: hunt.placementRule.referenceName,
    distanceMeters: d,
    distanceFeet: metersToFeet(d),
    limitMeters: hunt.placementRule.maxDistanceMeters,
    limitFeet: metersToFeet(hunt.placementRule.maxDistanceMeters),
    passes: d <= hunt.placementRule.maxDistanceMeters,
    checkpointStatus: first.checkpoint.status,
  };
}

// --------------------------------------------------------------------------
// Search zones: guidance without revealing the exact spot
// --------------------------------------------------------------------------

/** Small deterministic hash so a gem's search zone is stable between visits. */
function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export type SearchZone = { center: LatLng; radiusMeters: number; exact: boolean };

/**
 * Level 0 (no hints): a wide circle whose centre is offset from the real spot.
 * Level 1: a tighter circle. Level 2: the exact checkpoint.
 * The true checkpoint is always inside the circle (offset < radius).
 */
export function searchZoneFor(gem: Pick<GemConfig, "id" | "checkpoint">, hintLevel: number): SearchZone {
  if (hintLevel >= 2) return { center: gem.checkpoint, radiusMeters: 25, exact: true };
  const bearing = hashString(gem.id) % 360;
  const [offset, radius] = hintLevel === 1 ? [18, 55] : [45, 110];
  return { center: offsetPoint(gem.checkpoint, offset, bearing), radiusMeters: radius, exact: false };
}

export type Warmth = "far" | "warmer" | "close" | "here";

export function warmthFor(distanceMeters: number, radiusMeters: number): Warmth {
  if (distanceMeters <= radiusMeters) return "here";
  if (distanceMeters <= 80) return "close";
  if (distanceMeters <= 250) return "warmer";
  return "far";
}
