import type { GemConfig, HuntConfig, LatLng } from "@/config/hunt";
import { evaluateFix, offsetPoint, type GeoFix } from "@/lib/geo";
import type { VerifyResponse } from "@/lib/verification-types";

/**
 * DEMO MODE ONLY. Simulated GPS and simulated photo checks, so the full
 * journey can be tried away from campus. Every result produced here is marked
 * `source: "simulated"` and the UI shows a permanent Demo Mode banner.
 */

export type DemoOutcome = "pass" | "wrong_photo" | "uncertain" | "network_error" | "server_error";

export type DemoGps = {
  position: LatLng;
  accuracy: number;
  /** Age of the simulated fix, to test stale GPS. */
  ageMs: number;
};

export const DEMO_START: LatLng = { lat: 40.957211, lng: -76.882897 }; // Taylor Hall

export function demoFix(gps: DemoGps, now = Date.now()): GeoFix {
  return { ...gps.position, accuracy: gps.accuracy, timestamp: now - gps.ageMs };
}

export const demoPresets = (gem: GemConfig | null) => ({
  taylor: { position: DEMO_START, accuracy: 8, ageMs: 0 } satisfies DemoGps,
  atCheckpoint: gem ? ({ position: offsetPoint(gem.checkpoint, 6, 200), accuracy: 8, ageMs: 0 } satisfies DemoGps) : null,
  nearby: gem ? ({ position: offsetPoint(gem.checkpoint, 150, 300), accuracy: 8, ageMs: 0 } satisfies DemoGps) : null,
  poorGps: gem ? ({ position: offsetPoint(gem.checkpoint, 6, 200), accuracy: 85, ageMs: 0 } satisfies DemoGps) : null,
  staleGps: gem ? ({ position: offsetPoint(gem.checkpoint, 6, 200), accuracy: 8, ageMs: 120_000 } satisfies DemoGps) : null,
});

export async function simulatedVerify(
  hunt: HuntConfig,
  gem: GemConfig,
  fix: GeoFix,
  outcome: DemoOutcome,
): Promise<VerifyResponse> {
  await new Promise((r) => setTimeout(r, 900));
  if (outcome === "network_error") throw new TypeError("Simulated network failure");
  if (outcome === "server_error") {
    return { ok: false, error: "provider_error", message: "Simulated: the photo checker is temporarily unavailable.", retryable: true };
  }
  const location = evaluateFix(fix, gem, hunt.gps, Date.now(), hunt.placementRule);
  if (!location.passed) return { ok: true, location, photo: null, approved: false };
  if (outcome === "wrong_photo") {
    return {
      ok: true,
      location,
      approved: false,
      photo: {
        verdict: "retry",
        reason: "Simulated: this photo doesn't show the checkpoint.",
        feedback: gem.photo.instruction,
        source: "simulated",
      },
    };
  }
  if (outcome === "uncertain") {
    return {
      ok: true,
      location,
      approved: false,
      photo: {
        verdict: "uncertain",
        reason: "Simulated: the checker couldn't tell for sure.",
        feedback: gem.photo.instruction,
        source: "simulated",
      },
    };
  }
  return {
    ok: true,
    location,
    approved: true,
    photo: { verdict: "pass", reason: "Simulated pass (Demo Mode, not a real check).", feedback: "", source: "simulated" },
  };
}
