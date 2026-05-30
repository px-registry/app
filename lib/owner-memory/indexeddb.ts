// Stage B — IndexedDB backend (browser only).
//
// The owner's memory body lives here, in their own browser, under the
// `px-owner-memory` database. Nothing in this file talks to a network — there is
// no fetch, no sync, no server. This is the durable home of OwnerMemoryV1; the
// honest caveat (a browser data-clear wipes it) is why the UI promotes Export.
//
// Imported only from client components. node:test uses InMemoryBackend instead,
// so this DOM-only code never loads there.

import type { MemoryBackend } from "./backend.ts";
import type { OwnerMemoryV1 } from "./types.ts";

const DB_NAME = "px-owner-memory";
const STORE = "memory";
const VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "memoryId" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = run(t.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        t.oncomplete = () => db.close();
      }),
  );
}

/** The browser-backed owner memory store. Owner-local, never networked. */
export class IndexedDbBackend implements MemoryBackend {
  async list(): Promise<OwnerMemoryV1[]> {
    return (await tx<OwnerMemoryV1[]>("readonly", (s) => s.getAll())) ?? [];
  }
  async get(id: string): Promise<OwnerMemoryV1 | undefined> {
    return (await tx<OwnerMemoryV1 | undefined>("readonly", (s) => s.get(id))) ?? undefined;
  }
  async put(entry: OwnerMemoryV1): Promise<void> {
    await tx("readwrite", (s) => s.put(entry));
  }
  async remove(id: string): Promise<void> {
    await tx("readwrite", (s) => s.delete(id));
  }
  async clear(): Promise<void> {
    await tx("readwrite", (s) => s.clear());
  }
}
