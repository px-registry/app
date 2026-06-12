// R1.5 meet memory — IndexedDB backend (browser only; Stage B lineage:
// lib/owner-memory/indexeddb.ts).
//
// The owner's R1.5 memory body lives here, in their own browser, under the
// `px-meet` database. Nothing in this file talks to a network — no fetch, no
// sync, no server. A browser data-clear wipes it; that honest caveat is why the
// UI promotes 控えを保存 (export) — see STOP #2 (hybrid).
//
// Object stores (each its own lane, same keyPath discipline):
//   memory    — MeetMemoryEntryV1 (owner-authored substrate; THIS backend)
//   received  — proposals the owner's AI produced + the owner's readings
//               (separate shelf: never validated into the memory substrate)
//   firstnote — c17: 第一信の下書き, one per edge (peerRef-derived key);
//               like received, AI output that never re-enters a prompt
//   aliasmap  — R2 0010: entryId → item_ref（公開項目の安定 alias の対応表）
//
// Imported only from client components via the lib barrel. node:test uses
// InMemoryMeetBackend instead, so this DOM-only code never loads there.

import type { KeyedBackend } from "./backend.ts";

const DB_NAME = "px-meet";
export const MEMORY_STORE = "memory";
export const RECEIVED_STORE = "received";
export const FIRSTNOTE_STORE = "firstnote";
export const ALIAS_STORE = "aliasmap";
// v3 (R2 0010): + aliasmap store. v2 (c17): + firstnote. onupgradeneeded creates
// only what is missing, so older databases upgrade in place without touching
// existing lanes.
const VERSION = 3;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(MEMORY_STORE)) {
        db.createObjectStore(MEMORY_STORE, { keyPath: "entryId" });
      }
      if (!db.objectStoreNames.contains(RECEIVED_STORE)) {
        db.createObjectStore(RECEIVED_STORE, { keyPath: "entryId" });
      }
      if (!db.objectStoreNames.contains(FIRSTNOTE_STORE)) {
        db.createObjectStore(FIRSTNOTE_STORE, { keyPath: "entryId" });
      }
      if (!db.objectStoreNames.contains(ALIAS_STORE)) {
        db.createObjectStore(ALIAS_STORE, { keyPath: "entryId" });
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

/** The browser-backed store. Owner-local, never networked. */
export class IndexedDbMeetBackend<T extends { entryId: string }> implements KeyedBackend<T> {
  private store: string;
  constructor(store: string = MEMORY_STORE) {
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
  async remove(id: string): Promise<void> {
    await tx(this.store, "readwrite", (s) => s.delete(id));
  }
  async clear(): Promise<void> {
    await tx(this.store, "readwrite", (s) => s.clear());
  }
}
