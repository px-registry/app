// PX Memory v0.1 — IndexedDB backend (browser only・isolated DB).
//
// Owner の端末の中だけ。fetch / sync / server を持たない。既存の px-meet DB には
// 触らず、別 DB `px-memory-v01` を使う（隔離 — 既存 schema 非接触）。
// node:test は InMemoryBackend を使うので、この DOM 依存はそこで読まれない。

import type { MemoryBackend } from "./store.ts";

const DB_NAME = "px-memory-v01";
export const EVENTS_STORE = "events";
export const PROJECTIONS_STORE = "projections";
export const ANTENNA_STORE = "antenna";
const VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(EVENTS_STORE)) {
        db.createObjectStore(EVENTS_STORE, { keyPath: "eventId" });
      }
      if (!db.objectStoreNames.contains(PROJECTIONS_STORE)) {
        db.createObjectStore(PROJECTIONS_STORE, { keyPath: "projectionId" });
      }
      if (!db.objectStoreNames.contains(ANTENNA_STORE)) {
        db.createObjectStore(ANTENNA_STORE, { keyPath: "cardId" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(
  store: string,
  mode: IDBTransactionMode,
  run: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(store, mode);
        const req = run(t.objectStore(store));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        t.oncomplete = () => db.close();
      }),
  );
}

/** keyPath は object store が持つので、この class は key 名を知らない。 */
export class IndexedDbMemoryBackend<T> implements MemoryBackend<T> {
  private store: string;
  constructor(store: string) {
    this.store = store;
  }
  async list(): Promise<T[]> {
    return (await tx<T[]>(this.store, "readonly", (s) => s.getAll())) ?? [];
  }
  async get(id: string): Promise<T | undefined> {
    return (await tx<T | undefined>(this.store, "readonly", (s) => s.get(id))) ?? undefined;
  }
  async put(entry: T): Promise<void> {
    await tx(this.store, "readwrite", (s) => s.put(entry));
  }
  async clear(): Promise<void> {
    await tx(this.store, "readwrite", (s) => s.clear());
  }
}
