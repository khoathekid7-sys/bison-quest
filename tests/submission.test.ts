import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HUNT } from "@/config/hunt";
import { evaluateFix, offsetPoint, type GeoFix } from "@/lib/geo";
import { HuntStore } from "@/lib/storage";
import { _resetInFlight, submitCheckpoint, type SubmissionDeps } from "@/lib/submission";
import type { VerifyResponse } from "@/lib/verification-types";

const carnegie = HUNT.gems[0];
const NOW = 1_800_000_000_000;
const atCheckpoint: GeoFix = { ...offsetPoint(carnegie.checkpoint, 8, 10), accuracy: 6, timestamp: NOW };
const farAway: GeoFix = { ...offsetPoint(carnegie.checkpoint, 120, 10), accuracy: 6, timestamp: NOW };
const photoBlob = () => new Blob([new Uint8Array([0xff, 0xd8, 0xff, 1, 2, 3])], { type: "image/jpeg" });

type OkResponse = Extract<VerifyResponse, { ok: true }>;
const okResponse = (verdict: "pass" | "retry" | "uncertain", fix: GeoFix = atCheckpoint): OkResponse => {
  const location = evaluateFix(fix, carnegie, HUNT.gps, NOW);
  return {
    ok: true,
    location,
    approved: location.passed && verdict === "pass",
    photo: { verdict, reason: `model said ${verdict}`, feedback: verdict === "pass" ? "" : "Include the entrance.", source: "live" },
  };
};

let store: HuntStore;
let deps: SubmissionDeps;
let verify: ReturnType<typeof vi.fn<SubmissionDeps["verifyPhoto"]>>;

beforeEach(() => {
  _resetInFlight();
  store = new HuntStore(HUNT, "live", new IDBFactory());
  verify = vi.fn<SubmissionDeps["verifyPhoto"]>(async () => okResponse("pass"));
  deps = {
    hunt: HUNT,
    store,
    getFreshFix: async () => atCheckpoint,
    verifyPhoto: verify,
    isOnline: () => true,
    now: () => NOW,
  };
});

describe("submitCheckpoint", () => {
  it("valid location + valid photo awards the gem and unlocks the next one", async () => {
    const r = await submitCheckpoint(deps, "carnegie", photoBlob());
    expect(r.kind).toBe("awarded");
    const p = await store.loadProgress();
    expect(p.collected.map((c) => c.gemId)).toEqual(["carnegie"]);
    expect(await store.listPhotos()).toHaveLength(1);
    expect(await store.getPending("carnegie")).toBeUndefined();
  });

  it("wrong photo at the correct location fails, awards nothing, keeps the photo", async () => {
    verify.mockResolvedValue(okResponse("retry"));
    const r = await submitCheckpoint(deps, "carnegie", photoBlob());
    expect(r.kind).toBe("photo_failed");
    if (r.kind === "photo_failed") {
      expect(r.location.passed).toBe(true);
      expect(r.photo.feedback).toMatch(/entrance/);
    }
    expect((await store.loadProgress()).collected).toHaveLength(0);
    expect(await store.getPending("carnegie")).toBeDefined();
  });

  it("correct photo outside the geofence fails before the photo is even sent", async () => {
    deps.getFreshFix = async () => farAway;
    const r = await submitCheckpoint(deps, "carnegie", photoBlob());
    expect(r.kind).toBe("location_failed");
    expect(verify).not.toHaveBeenCalled();
    expect((await store.loadProgress()).collected).toHaveLength(0);
    expect(await store.getPending("carnegie")).toBeDefined();
  });

  it("a server-side location failure also blocks the award", async () => {
    verify.mockResolvedValue({ ...okResponse("pass", farAway), approved: false, photo: null });
    const r = await submitCheckpoint(deps, "carnegie", photoBlob());
    expect(r.kind).toBe("location_failed");
    expect((await store.loadProgress()).collected).toHaveLength(0);
  });

  it("poor GPS accuracy fails the location check (no automatic acceptance)", async () => {
    deps.getFreshFix = async () => ({ ...atCheckpoint, accuracy: 90 });
    const r = await submitCheckpoint(deps, "carnegie", photoBlob());
    expect(r.kind).toBe("location_failed");
    if (r.kind === "location_failed") expect(r.location.status).toBe("low_accuracy");
  });

  it("uncertain recognition does not unlock a gem", async () => {
    verify.mockResolvedValue(okResponse("uncertain"));
    const r = await submitCheckpoint(deps, "carnegie", photoBlob());
    expect(r.kind).toBe("uncertain");
    expect((await store.loadProgress()).collected).toHaveLength(0);
  });

  it("a 'pass' verdict without server approval is not trusted", async () => {
    verify.mockResolvedValue({ ...okResponse("pass"), approved: false });
    const r = await submitCheckpoint(deps, "carnegie", photoBlob());
    expect(r.kind).toBe("photo_failed");
    expect((await store.loadProgress()).collected).toHaveLength(0);
  });

  it("duplicate concurrent submissions do not double-advance", async () => {
    let release!: () => void;
    verify.mockImplementation(() => new Promise((res) => (release = () => res(okResponse("pass")))));
    const first = submitCheckpoint(deps, "carnegie", photoBlob());
    await vi.waitFor(() => expect(verify).toHaveBeenCalledTimes(1));
    const second = await submitCheckpoint(deps, "carnegie", photoBlob());
    expect(second.kind).toBe("busy");
    release();
    expect((await first).kind).toBe("awarded");
    const third = await submitCheckpoint(deps, "carnegie", photoBlob());
    expect(third.kind).toBe("already_collected");
    const p = await store.loadProgress();
    expect(p.collected).toHaveLength(1);
    expect(await store.listPhotos()).toHaveLength(1);
    expect(verify).toHaveBeenCalledTimes(1);
  });

  it("an on-device blank-photo precheck stops before upload and keeps the photo", async () => {
    deps.precheckPhoto = async () => ({ verdict: "retry", reason: "blank", feedback: "Uncover the lens.", source: "precheck" });
    const r = await submitCheckpoint(deps, "carnegie", photoBlob());
    expect(r.kind).toBe("photo_failed");
    expect(verify).not.toHaveBeenCalled();
    expect(await store.getPending("carnegie")).toBeDefined();
  });

  it("cannot submit a locked (future) gem", async () => {
    const r = await submitCheckpoint(deps, "elc-patio", photoBlob());
    expect(r.kind).toBe("not_current");
    expect(verify).not.toHaveBeenCalled();
  });

  it("API network failure preserves the pending photo for retry", async () => {
    verify.mockRejectedValue(new TypeError("Failed to fetch"));
    const r = await submitCheckpoint(deps, "carnegie", photoBlob());
    expect(r.kind).toBe("service_error");
    const pending = await store.getPending("carnegie");
    expect(pending).toBeDefined();
    expect(new Uint8Array(pending!.data)).toEqual(new Uint8Array([0xff, 0xd8, 0xff, 1, 2, 3]));
    // Retry with the same saved photo succeeds.
    verify.mockResolvedValue(okResponse("pass"));
    const retry = await submitCheckpoint(deps, "carnegie", new Blob([pending!.data], { type: pending!.type }));
    expect(retry.kind).toBe("awarded");
  });

  it("provider errors (structured) preserve the photo and award nothing", async () => {
    verify.mockResolvedValue({ ok: false, error: "provider_error", message: "busy", retryable: true });
    const r = await submitCheckpoint(deps, "carnegie", photoBlob());
    expect(r.kind).toBe("service_error");
    expect(await store.getPending("carnegie")).toBeDefined();
    expect((await store.loadProgress()).collected).toHaveLength(0);
  });

  it("offline: explains reconnection is needed and keeps the photo", async () => {
    deps.isOnline = () => false;
    const r = await submitCheckpoint(deps, "carnegie", photoBlob());
    expect(r.kind).toBe("offline");
    expect(verify).not.toHaveBeenCalled();
    expect(await store.getPending("carnegie")).toBeDefined();
  });

  it("storage failure at commit time reports an error instead of claiming success", async () => {
    deps.store = {
      loadProgress: () => store.loadProgress(),
      savePending: () => Promise.reject(new Error("quota")),
      commitAward: () => Promise.reject(new Error("quota")),
    };
    const r = await submitCheckpoint(deps, "carnegie", photoBlob());
    expect(r.kind).toBe("storage_error");
  });
});
