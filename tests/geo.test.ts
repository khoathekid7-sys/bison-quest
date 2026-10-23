import { describe, expect, it } from "vitest";
import { HUNT, type HuntConfig } from "@/config/hunt";
import {
  checkPlacementRule,
  evaluateFix,
  formatApproxDistance,
  haversineMeters,
  metersToFeet,
  offsetPoint,
  searchZoneFor,
} from "@/lib/geo";

const carnegie = HUNT.gems[0];
const NOW = 1_800_000_000_000;

describe("haversineMeters", () => {
  it("is zero for the same point", () => {
    expect(haversineMeters(carnegie.checkpoint, carnegie.checkpoint)).toBe(0);
  });

  it("matches a known reference distance (1° of latitude ≈ 111.2 km)", () => {
    const d = haversineMeters({ lat: 40, lng: -76.88 }, { lat: 41, lng: -76.88 });
    expect(d).toBeGreaterThan(111_100);
    expect(d).toBeLessThan(111_300);
  });

  it("round-trips with offsetPoint for short campus distances", () => {
    for (const [m, b] of [[30, 0], [152.4, 90], [500, 225]] as const) {
      const p = offsetPoint(carnegie.checkpoint, m, b);
      expect(haversineMeters(carnegie.checkpoint, p)).toBeCloseTo(m, 1);
    }
  });

  it("converts the 500 ft rule to 152.4 m", () => {
    expect(metersToFeet(152.4)).toBeCloseTo(500, 6);
  });
});

describe("500-foot first-checkpoint placement rule", () => {
  it("the configured first checkpoint (Carnegie) is within 500 ft of Taylor Hall", () => {
    const r = checkPlacementRule(HUNT);
    expect(r.gemId).toBe("carnegie");
    expect(r.passes).toBe(true);
    // Independently computed: ≈131 m (≈431 ft). Guard against accidental edits.
    expect(r.distanceMeters).toBeGreaterThan(125);
    expect(r.distanceMeters).toBeLessThan(137);
    expect(r.distanceFeet).toBeLessThan(500);
  });

  it("fails when the first checkpoint is moved beyond 152.4 m", () => {
    const far = offsetPoint(HUNT.placementRule.reference, 160, 135);
    const hunt: HuntConfig = {
      ...HUNT,
      gems: [{ ...carnegie, checkpoint: { ...carnegie.checkpoint, ...far } }, ...HUNT.gems.slice(1)],
    };
    expect(checkPlacementRule(hunt).passes).toBe(false);
  });

  it("is computed independently of the gameplay arrival radius", () => {
    const hunt: HuntConfig = { ...HUNT, gems: [{ ...carnegie, arrivalRadiusMeters: 1 }, ...HUNT.gems.slice(1)] };
    expect(checkPlacementRule(hunt).distanceMeters).toBeCloseTo(checkPlacementRule(HUNT).distanceMeters, 6);
  });

  it("accepts exactly 152.4 m and rejects just beyond it", () => {
    const at = offsetPoint(HUNT.placementRule.reference, 152.39, 90);
    const beyond = offsetPoint(HUNT.placementRule.reference, 152.5, 90);
    const make = (p: { lat: number; lng: number }): HuntConfig => ({
      ...HUNT,
      gems: [{ ...carnegie, checkpoint: { ...carnegie.checkpoint, ...p } }],
    });
    expect(checkPlacementRule(make(at)).passes).toBe(true);
    expect(checkPlacementRule(make(beyond)).passes).toBe(false);
  });
});

describe("evaluateFix (gameplay geofence)", () => {
  const fixAt = (meters: number, accuracy = 8, ageMs = 0) => ({
    ...offsetPoint(carnegie.checkpoint, meters, 45),
    accuracy,
    timestamp: NOW - ageMs,
  });

  it("passes inside the arrival radius with good accuracy", () => {
    const r = evaluateFix(fixAt(12), carnegie, HUNT.gps, NOW);
    expect(r.status).toBe("in_range");
    expect(r.passed).toBe(true);
  });

  it("fails outside the radius", () => {
    const r = evaluateFix(fixAt(carnegie.arrivalRadiusMeters + 15), carnegie, HUNT.gps, NOW);
    expect(r.status).toBe("out_of_range");
    expect(r.passed).toBe(false);
    expect(r.message).toMatch(/straight line/);
  });

  it("never accepts low-accuracy GPS, even when the reported point is on target", () => {
    const r = evaluateFix(fixAt(0, HUNT.gps.maxAccuracyMeters + 1), carnegie, HUNT.gps, NOW);
    expect(r.status).toBe("low_accuracy");
    expect(r.passed).toBe(false);
    expect(r.message).toMatch(/fuzzy/i);
  });

  it("rejects stale fixes", () => {
    const r = evaluateFix(fixAt(0, 5, HUNT.gps.maxFixAgeMs + 1), carnegie, HUNT.gps, NOW);
    expect(r.status).toBe("stale");
    expect(r.passed).toBe(false);
  });

  it("reports unavailable for a missing or invalid fix", () => {
    expect(evaluateFix(null, carnegie, HUNT.gps, NOW).status).toBe("unavailable");
    expect(evaluateFix({ lat: NaN, lng: 1, accuracy: 5, timestamp: NOW }, carnegie, HUNT.gps, NOW).status).toBe("unavailable");
  });
});

describe("placement rule enforced at play time (gem 1)", () => {
  it("rejects the far side of the arrival circle that is >500 ft from Taylor Hall", () => {
    // 28 m south-east of the Carnegie entrance: inside the 30 m circle, but ~159 m from Taylor.
    const far = { ...offsetPoint(carnegie.checkpoint, 28, 135), accuracy: 5, timestamp: NOW };
    expect(haversineMeters(far, HUNT.placementRule.reference)).toBeGreaterThan(152.4);
    const r = evaluateFix(far, carnegie, HUNT.gps, NOW, HUNT.placementRule);
    expect(r.passed).toBe(false);
    expect(r.message).toMatch(/Taylor Hall side/);
  });

  it("accepts the Taylor-facing side of the circle", () => {
    const near = { ...offsetPoint(carnegie.checkpoint, 25, 315), accuracy: 5, timestamp: NOW };
    expect(evaluateFix(near, carnegie, HUNT.gps, NOW, HUNT.placementRule).passed).toBe(true);
  });

  it("only applies to gems that opt in", () => {
    const elc = HUNT.gems[1];
    expect(elc.enforcePlacementRule).toBeFalsy();
    const at = { ...offsetPoint(elc.checkpoint, 5, 0), accuracy: 5, timestamp: NOW };
    expect(evaluateFix(at, elc, HUNT.gps, NOW, HUNT.placementRule).passed).toBe(true);
  });
});

describe("search zones", () => {
  it("always contain the true checkpoint and shrink with hints", () => {
    for (const gem of HUNT.gems) {
      const radii = [0, 1, 2].map((lvl) => {
        const z = searchZoneFor(gem, lvl);
        expect(haversineMeters(z.center, gem.checkpoint)).toBeLessThan(z.radiusMeters);
        return z.radiusMeters;
      });
      expect(radii[0]).toBeGreaterThan(radii[1]);
      expect(searchZoneFor(gem, 2).exact).toBe(true);
      expect(searchZoneFor(gem, 0).exact).toBe(false);
    }
  });

  it("level 0 zone is not centred on the exact spot", () => {
    const z = searchZoneFor(carnegie, 0);
    expect(haversineMeters(z.center, carnegie.checkpoint)).toBeGreaterThan(20);
  });
});

describe("formatApproxDistance", () => {
  it("rounds and shows metres and feet", () => {
    expect(formatApproxDistance(131.2)).toBe("≈ 130 m (430 ft)");
    expect(formatApproxDistance(4)).toBe("less than 10 m");
  });
});
