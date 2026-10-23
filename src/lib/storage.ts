import type { HuntConfig } from "@/config/hunt";
import {
  applyAward,
  initialProgress,
  isValidProgress,
  type CollectedGem,
  type PlayMode,
  type Progress,
} from "@/lib/progress";

/**
 * Local persistence in IndexedDB. Live play and Demo Mode use SEPARATE
 * databases so simulated progress can never leak into a real hunt.
 *
 * Photos are stored as ArrayBuffer + MIME type rather than Blob, which avoids
 * older Safari bugs with Blobs in IndexedDB.
 */

export type StoredPhoto = {
  id: string;
  gemId: string;
  type: string;
  data: ArrayBuffer;
  createdAt: number;
};

export type PendingPhoto = {
  gemId: string;
  type: string;
  data: ArrayBuffer;
  capturedAt: number;
};

export class StorageUnavailableError extends Error {
  constructor(cause?: unknown) {
    super("Local storage is unavailable");
    this.cause = cause;
  }
}

const DB_VERSION = 1;
const PROGRESS_KEY = "progress";

export const dbNameFor = (mode: PlayMode) => `bison-quest-${mode}`;

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error ?? new Error("Transaction aborted"));
    tx.onerror = () => reject(tx.error);
  });
}

function openDb(name: string, factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let r: IDBOpenDBRequest;
    try {
      r = factory.open(name, DB_VERSION);
    } catch (e) {
      reject(new StorageUnavailableError(e));
      return;
    }
    r.onupgradeneeded = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains("kv")) db.createObjectStore("kv");
      if (!db.objectStoreNames.contains("photos")) db.createObjectStore("photos", { keyPath: "id" });
      if (!db.objectStoreNames.contains("pending")) db.createObjectStore("pending", { keyPath: "gemId" });
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(new StorageUnavailableError(r.error));
    r.onblocked = () => reject(new StorageUnavailableError(new Error("Database blocked by another tab")));
  });
}

export class HuntStore {
  readonly persistent = true;
  private dbPromise: Promise<IDBDatabase> | null = null;

  constructor(
    readonly hunt: HuntConfig,
    readonly mode: PlayMode,
    private factory: IDBFactory = globalThis.indexedDB,
  ) {}

  private db(): Promise<IDBDatabase> {
    if (!this.factory) return Promise.reject(new StorageUnavailableError());
    this.dbPromise ??= openDb(dbNameFor(this.mode), this.factory);
    return this.dbPromise;
  }

  /** Loads progress (or a fresh one). A hunt-version mismatch starts fresh. */
  async loadProgress(): Promise<Progress> {
    const db = await this.db();
    const tx = db.transaction("kv", "readonly");
    const value = await req(tx.objectStore("kv").get(PROGRESS_KEY));
    if (isValidProgress(value, this.hunt) && value.mode === this.mode) return value;
    return initialProgress(this.hunt, this.mode);
  }

  async saveProgress(p: Progress): Promise<void> {
    const db = await this.db();
    const tx = db.transaction("kv", "readwrite");
    tx.objectStore("kv").put(p, PROGRESS_KEY);
    await txDone(tx);
  }

  async listPhotos(): Promise<StoredPhoto[]> {
    const db = await this.db();
    const tx = db.transaction("photos", "readonly");
    return req(tx.objectStore("photos").getAll() as IDBRequest<StoredPhoto[]>);
  }

  async getPhoto(id: string): Promise<StoredPhoto | undefined> {
    const db = await this.db();
    const tx = db.transaction("photos", "readonly");
    return req(tx.objectStore("photos").get(id) as IDBRequest<StoredPhoto | undefined>);
  }

  async savePending(p: PendingPhoto): Promise<void> {
    const db = await this.db();
    const tx = db.transaction("pending", "readwrite");
    tx.objectStore("pending").put(p);
    await txDone(tx);
  }

  async getPending(gemId: string): Promise<PendingPhoto | undefined> {
    const db = await this.db();
    const tx = db.transaction("pending", "readonly");
    return req(tx.objectStore("pending").get(gemId) as IDBRequest<PendingPhoto | undefined>);
  }

  async clearPending(gemId: string): Promise<void> {
    const db = await this.db();
    const tx = db.transaction("pending", "readwrite");
    tx.objectStore("pending").delete(gemId);
    await txDone(tx);
  }

  /**
   * Atomically: re-read progress, validate the award (order + no duplicates),
   * store the accepted photo, save the new progress, and clear the pending
   * photo. Either all of it is written or none of it is.
   */
  async commitAward(
    gemId: string,
    photo: { type: string; data: ArrayBuffer },
    verification: CollectedGem["verification"],
    now = Date.now(),
  ): Promise<Progress> {
    const db = await this.db();
    const tx = db.transaction(["kv", "photos", "pending"], "readwrite");
    const done = txDone(tx);
    const kv = tx.objectStore("kv");
    let next: Progress | null = null;
    let failure: unknown = null;

    const getReq = kv.get(PROGRESS_KEY);
    getReq.onsuccess = () => {
      try {
        const stored = getReq.result;
        const current =
          isValidProgress(stored, this.hunt) && stored.mode === this.mode
            ? stored
            : initialProgress(this.hunt, this.mode);
        const photoId = `${gemId}-${now}`;
        next = applyAward(current, this.hunt, { gemId, photoId, collectedAt: now, verification });
        tx.objectStore("photos").put({ id: photoId, gemId, type: photo.type, data: photo.data, createdAt: now } satisfies StoredPhoto);
        kv.put(next, PROGRESS_KEY);
        tx.objectStore("pending").delete(gemId);
      } catch (e) {
        failure = e;
        tx.abort();
      }
    };

    try {
      await done;
    } catch (e) {
      throw failure ?? new StorageUnavailableError(e);
    }
    if (failure) throw failure;
    if (!next) throw new StorageUnavailableError();
    return next;
  }

  /** Deletes everything for this mode (progress, accepted and pending photos). */
  async deleteAll(): Promise<void> {
    const db = await this.db();
    const tx = db.transaction(["kv", "photos", "pending"], "readwrite");
    tx.objectStore("kv").clear();
    tx.objectStore("photos").clear();
    tx.objectStore("pending").clear();
    await txDone(tx);
  }

  close() {
    this.dbPromise?.then((db) => db.close()).catch(() => {});
    this.dbPromise = null;
  }
}

/** Deletes both live and demo databases entirely. */
export async function deleteAllHuntData(factory: IDBFactory = globalThis.indexedDB): Promise<void> {
  await Promise.all(
    (["live", "demo"] as const).map(
      (mode) =>
        new Promise<void>((resolve, reject) => {
          const r = factory.deleteDatabase(dbNameFor(mode));
          r.onsuccess = () => resolve();
          r.onerror = () => reject(r.error);
          r.onblocked = () => resolve(); // completes once other connections close
        }),
    ),
  );
}
