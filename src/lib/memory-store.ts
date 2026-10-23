import type { HuntConfig } from "@/config/hunt";
import { applyAward, initialProgress, type CollectedGem, type PlayMode, type Progress } from "@/lib/progress";
import type { HuntStore, PendingPhoto, StoredPhoto } from "@/lib/storage";

export type HuntStoreLike = Pick<
  HuntStore,
  | "loadProgress"
  | "saveProgress"
  | "listPhotos"
  | "getPhoto"
  | "savePending"
  | "getPending"
  | "clearPending"
  | "commitAward"
  | "deleteAll"
  | "close"
> & { readonly mode: PlayMode; readonly persistent: boolean };

/**
 * Fallback used only when the browser refuses IndexedDB (some private
 * browsing modes). Everything is lost when the tab closes, and the UI says so.
 */
export class MemoryHuntStore implements HuntStoreLike {
  readonly persistent = false;
  private progress: Progress;
  private photos = new Map<string, StoredPhoto>();
  private pending = new Map<string, PendingPhoto>();

  constructor(
    private hunt: HuntConfig,
    readonly mode: PlayMode,
  ) {
    this.progress = initialProgress(hunt, mode);
  }
  async loadProgress() {
    return this.progress;
  }
  async saveProgress(p: Progress) {
    this.progress = p;
  }
  async listPhotos() {
    return [...this.photos.values()];
  }
  async getPhoto(id: string) {
    return this.photos.get(id);
  }
  async savePending(p: PendingPhoto) {
    this.pending.set(p.gemId, p);
  }
  async getPending(gemId: string) {
    return this.pending.get(gemId);
  }
  async clearPending(gemId: string) {
    this.pending.delete(gemId);
  }
  async commitAward(gemId: string, photo: { type: string; data: ArrayBuffer }, verification: CollectedGem["verification"], now = Date.now()) {
    const photoId = `${gemId}-${now}`;
    const next = applyAward(this.progress, this.hunt, { gemId, photoId, collectedAt: now, verification });
    this.photos.set(photoId, { id: photoId, gemId, type: photo.type, data: photo.data, createdAt: now });
    this.pending.delete(gemId);
    this.progress = next;
    return next;
  }
  async deleteAll() {
    this.progress = initialProgress(this.hunt, this.mode);
    this.photos.clear();
    this.pending.clear();
  }
  close() {}
}
