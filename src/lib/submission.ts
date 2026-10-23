import type { GemConfig, HuntConfig } from "@/config/hunt";
import { evaluateFix, type GeoFix, type LocationCheck } from "@/lib/geo";
import { AwardError, currentGem, type Progress } from "@/lib/progress";
import type { HuntStore } from "@/lib/storage";
import type { PhotoCheck, VerifyResponse } from "@/lib/verification-types";

export type SubmissionDeps = {
  hunt: HuntConfig;
  store: Pick<HuntStore, "loadProgress" | "savePending" | "commitAward">;
  /** Must request a FRESH fix (maximumAge 0), not reuse a cached one. */
  getFreshFix: () => Promise<GeoFix | null>;
  verifyPhoto: (args: { gem: GemConfig; photo: Blob; fix: GeoFix }) => Promise<VerifyResponse>;
  isOnline: () => boolean;
  /** Optional on-device check (e.g. blank photo). Returning a result stops before upload. */
  precheckPhoto?: (photo: Blob) => Promise<PhotoCheck | null>;
  now?: () => number;
};

export type SubmissionResult =
  | { kind: "awarded"; progress: Progress; location: LocationCheck; photo: PhotoCheck }
  | { kind: "location_failed"; location: LocationCheck; pendingSaved: boolean }
  | { kind: "photo_failed"; location: LocationCheck; photo: PhotoCheck; pendingSaved: boolean }
  | { kind: "uncertain"; location: LocationCheck; photo: PhotoCheck; pendingSaved: boolean }
  | { kind: "offline"; location: LocationCheck; pendingSaved: boolean }
  | { kind: "service_error"; location: LocationCheck | null; message: string; retryable: boolean; pendingSaved: boolean }
  | { kind: "storage_error"; location: LocationCheck; photo: PhotoCheck; message: string }
  | { kind: "already_collected" }
  | { kind: "not_current" }
  | { kind: "busy" };

const inFlight = new Set<string>();

/** Test helper. */
export function _resetInFlight() {
  inFlight.clear();
}

/**
 * Runs one checkpoint submission end to end. A gem is awarded ONLY when the
 * client location check, the server location check and the photo check all
 * pass, and the atomic storage commit succeeds. Every other outcome keeps the
 * pending photo so the player can retry without retaking it.
 */
export async function submitCheckpoint(
  deps: SubmissionDeps,
  gemId: string,
  photo: Blob,
): Promise<SubmissionResult> {
  if (inFlight.has(gemId)) return { kind: "busy" };
  inFlight.add(gemId);
  const now = deps.now ?? Date.now;
  try {
    const progress = await deps.store.loadProgress();
    if (progress.collected.some((c) => c.gemId === gemId)) return { kind: "already_collected" };
    const gem = currentGem(progress, deps.hunt);
    if (!gem || gem.id !== gemId) return { kind: "not_current" };

    const data = await photo.arrayBuffer();
    let pendingSaved = true;
    try {
      await deps.store.savePending({ gemId, type: photo.type || "image/jpeg", data, capturedAt: now() });
    } catch {
      pendingSaved = false; // keep going; the UI warns that the photo is only in memory
    }

    const fix = await deps.getFreshFix().catch(() => null);
    const location = evaluateFix(fix, gem, deps.hunt.gps, now(), deps.hunt.placementRule);
    if (!location.passed || !fix) return { kind: "location_failed", location, pendingSaved };

    const pre = deps.precheckPhoto ? await deps.precheckPhoto(photo).catch(() => null) : null;
    if (pre) return { kind: "photo_failed", location, photo: pre, pendingSaved };

    if (!deps.isOnline()) return { kind: "offline", location, pendingSaved };

    let resp: VerifyResponse;
    try {
      resp = await deps.verifyPhoto({ gem, photo, fix });
    } catch {
      return {
        kind: deps.isOnline() ? "service_error" : "offline",
        location,
        message: "We couldn't reach the photo checker. Your photo is safe — try again in a moment.",
        retryable: true,
        pendingSaved,
      } as SubmissionResult;
    }

    if (!resp.ok) {
      return { kind: "service_error", location, message: resp.message, retryable: resp.retryable, pendingSaved };
    }
    if (!resp.location.passed) return { kind: "location_failed", location: resp.location, pendingSaved };
    if (!resp.photo) {
      return { kind: "service_error", location, message: "The photo wasn't checked. Please try again.", retryable: true, pendingSaved };
    }
    if (resp.photo.verdict === "uncertain") return { kind: "uncertain", location: resp.location, photo: resp.photo, pendingSaved };
    if (resp.photo.verdict !== "pass" || !resp.approved) {
      return { kind: "photo_failed", location: resp.location, photo: resp.photo, pendingSaved };
    }

    try {
      const next = await deps.store.commitAward(
        gemId,
        { type: photo.type || "image/jpeg", data },
        resp.photo.source === "live" ? "live" : "simulated",
        now(),
      );
      return { kind: "awarded", progress: next, location: resp.location, photo: resp.photo };
    } catch (e) {
      if (e instanceof AwardError && e.code === "duplicate") return { kind: "already_collected" };
      if (e instanceof AwardError) return { kind: "not_current" };
      return {
        kind: "storage_error",
        location: resp.location,
        photo: resp.photo,
        message:
          "Both checks passed, but your phone wouldn't let us save the photo, so the gem isn't collected yet. Free up some storage or leave private browsing, then tap Try again.",
      };
    }
  } finally {
    inFlight.delete(gemId);
  }
}
