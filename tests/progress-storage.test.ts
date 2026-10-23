import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it } from "vitest";
import { HUNT } from "@/config/hunt";
import { AwardError, applyAward, currentGem, gemState, initialProgress, isComplete, isValidProgress } from "@/lib/progress";
import { HuntStore } from "@/lib/storage";

const award = (gemId: string, at = 1000) => ({ gemId, photoId: `${gemId}-${at}`, collectedAt: at, verification: "live" as const });
const photo = (n = 1) => ({ type: "image/jpeg", data: new Uint8Array([0xff, 0xd8, n]).buffer });

describe("ordered gem progression (pure)", () => {
  it("starts on the first gem with the rest locked", () => {
    const p = initialProgress(HUNT, "live");
    expect(currentGem(p, HUNT)?.id).toBe("carnegie");
    expect(gemState(p, HUNT, "carnegie")).toBe("active");
    expect(gemState(p, HUNT, "elc-patio")).toBe("locked");
  });

  it("unlocks the next gem exactly once, in order", () => {
    let p = initialProgress(HUNT, "live");
    p = applyAward(p, HUNT, award("carnegie"));
    expect(currentGem(p, HUNT)?.id).toBe("elc-patio");
    expect(gemState(p, HUNT, "carnegie")).toBe("collected");
    expect(p.unseenDiscovery).toBe("carnegie");
    p = applyAward(p, HUNT, award("elc-patio"));
    expect(isComplete(p, HUNT)).toBe(true);
  });

  it("rejects out-of-order awards", () => {
    const p = initialProgress(HUNT, "live");
    expect(() => applyAward(p, HUNT, award("elc-patio"))).toThrow(AwardError);
    try {
      applyAward(p, HUNT, award("elc-patio"));
    } catch (e) {
      expect((e as AwardError).code).toBe("out_of_order");
    }
  });

  it("rejects duplicate awards", () => {
    const p = applyAward(initialProgress(HUNT, "live"), HUNT, award("carnegie"));
    expect(() => applyAward(p, HUNT, award("carnegie"))).toThrow(/duplicate/);
  });

  it("rejects unknown gems and stored data from a different hunt", () => {
    expect(() => applyAward(initialProgress(HUNT, "live"), HUNT, award("nope"))).toThrow(/unknown_gem/);
    expect(isValidProgress({ ...initialProgress(HUNT, "live"), huntId: "other" }, HUNT)).toBe(false);
    expect(isValidProgress({ ...initialProgress(HUNT, "live"), collected: [award("elc-patio")] }, HUNT)).toBe(false);
  });
});

describe("IndexedDB storage", () => {
  let factory: IDBFactory;
  beforeEach(() => {
    factory = new IDBFactory();
  });

  it("commits the accepted photo and progress together, and clears the pending photo", async () => {
    const store = new HuntStore(HUNT, "live", factory);
    await store.savePending({ gemId: "carnegie", ...photo(), capturedAt: 1 });
    const next = await store.commitAward("carnegie", photo(7), "live", 5000);
    expect(next.collected.map((c) => c.gemId)).toEqual(["carnegie"]);
    const photos = await store.listPhotos();
    expect(photos).toHaveLength(1);
    expect(new Uint8Array(photos[0].data)[2]).toBe(7);
    expect(await store.getPending("carnegie")).toBeUndefined();
  });

  it("refresh restores progress and accepted photos (new connection, same browser storage)", async () => {
    const a = new HuntStore(HUNT, "live", factory);
    await a.saveProgress({ ...initialProgress(HUNT, "live"), onboarded: true });
    await a.commitAward("carnegie", photo(3), "live", 42);
    a.close();

    const b = new HuntStore(HUNT, "live", factory);
    const p = await b.loadProgress();
    expect(p.onboarded).toBe(true);
    expect(p.collected).toHaveLength(1);
    expect(currentGem(p, HUNT)?.id).toBe("elc-patio");
    const photos = await b.listPhotos();
    expect(photos.map((x) => x.id)).toEqual([p.collected[0].photoId]);
  });

  it("a duplicate commit is rejected and writes nothing", async () => {
    const store = new HuntStore(HUNT, "live", factory);
    await store.commitAward("carnegie", photo(1), "live", 1);
    await expect(store.commitAward("carnegie", photo(2), "live", 2)).rejects.toMatchObject({ code: "duplicate" });
    expect(await store.listPhotos()).toHaveLength(1);
    expect((await store.loadProgress()).collected).toHaveLength(1);
  });

  it("an out-of-order commit is rejected and the photo is not stored", async () => {
    const store = new HuntStore(HUNT, "live", factory);
    await expect(store.commitAward("elc-patio", photo(), "live", 1)).rejects.toMatchObject({ code: "out_of_order" });
    expect(await store.listPhotos()).toHaveLength(0);
  });

  it("keeps live and demo progress completely separate", async () => {
    const demo = new HuntStore(HUNT, "demo", factory);
    await demo.commitAward("carnegie", photo(), "simulated", 1);
    const live = new HuntStore(HUNT, "live", factory);
    expect((await live.loadProgress()).collected).toHaveLength(0);
    expect(await live.listPhotos()).toHaveLength(0);
  });

  it("deleteAll erases progress, photos and pending photos", async () => {
    const store = new HuntStore(HUNT, "live", factory);
    await store.commitAward("carnegie", photo(), "live", 1);
    await store.savePending({ gemId: "elc-patio", ...photo(), capturedAt: 2 });
    await store.deleteAll();
    expect((await store.loadProgress()).collected).toHaveLength(0);
    expect(await store.listPhotos()).toHaveLength(0);
    expect(await store.getPending("elc-patio")).toBeUndefined();
  });
});
