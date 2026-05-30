// Board Templates v1 — IndexedDB draft backend (browser only).
//
// The owner's draft boards live here, in their own browser, under the
// `px-board-drafts` database. Nothing in this file talks to a network — there is
// no fetch, no sync, no server. This is the durable home of DraftBoardV1; like
// Stage B memory, a browser data-clear wipes it (the UI says so plainly).
//
// Imported only from client components. node:test uses InMemoryDraftBackend
// instead, so this DOM-only code never loads there.

import type { DraftBackend } from "./backend.ts";
import type { DraftBoardV1 } from "./types.ts";

const DB_NAME = "px-board-drafts";
const STORE = "drafts";
const VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "draftId" });
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

/** The browser-backed draft store. Owner-local, never networked. */
export class IndexedDbDraftBackend implements DraftBackend {
  async list(): Promise<DraftBoardV1[]> {
    return (await tx<DraftBoardV1[]>("readonly", (s) => s.getAll())) ?? [];
  }
  async get(id: string): Promise<DraftBoardV1 | undefined> {
    return (await tx<DraftBoardV1 | undefined>("readonly", (s) => s.get(id))) ?? undefined;
  }
  async put(draft: DraftBoardV1): Promise<void> {
    await tx("readwrite", (s) => s.put(draft));
  }
  async remove(id: string): Promise<void> {
    await tx("readwrite", (s) => s.delete(id));
  }
  async clear(): Promise<void> {
    await tx("readwrite", (s) => s.clear());
  }
}
