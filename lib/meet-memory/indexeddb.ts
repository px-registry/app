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
//   journal   — 記憶装置 層1a: MemJournalRecordV1（append-only の長さ; keyPath は
//               recordId）。既存 lane は不触 — additive に足すだけ。
//
// Imported only from client components via the lib barrel. node:test uses
// InMemoryMeetBackend instead, so this DOM-only code never loads there.

import type { KeyedBackend } from "./backend.ts";

const DB_NAME = "px-meet";
export const MEMORY_STORE = "memory";
export const RECEIVED_STORE = "received";
export const FIRSTNOTE_STORE = "firstnote";
export const ALIAS_STORE = "aliasmap";
export const ENCKEY_STORE = "enckey";
export const TALK_STORE = "talk";
export const PEERKEY_STORE = "peerkey";
export const JOURNAL_STORE = "journal";
export const WINDOWCHAT_STORE = "windowchat";
// Device Mesh（Phase A）— private はこの端末にだけ住む 3 lane:
export const MESHID_STORE = "meshid"; // singleton: { ownerRef, deviceId }
export const MESHDEVICE_STORE = "meshdevice"; // singleton: device の sig/enc keypair（private 含む）
export const MESHEPOCH_STORE = "meshepoch"; // epoch → epoch keypair（private 含む・過去 epoch も保持）
// v8 (Device Mesh Phase A): + meshid / meshdevice / meshepoch（端末横断同期の鍵・身元）。
// v7 (記憶装置 層2b): + windowchat（②opt-in の会話控え・既定では空）。
// v6 (記憶装置 層1a): + journal (keyPath recordId). v5 (R2 便6): + talk / peerkey.
// v4 (R2 0013): + enckey. v3 (R2 0010): + aliasmap. v2 (c17): + firstnote.
// onupgradeneeded creates only what is missing, so older databases upgrade in
// place without touching existing lanes.
const VERSION = 8;

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
      if (!db.objectStoreNames.contains(ENCKEY_STORE)) {
        db.createObjectStore(ENCKEY_STORE, { keyPath: "entryId" });
      }
      if (!db.objectStoreNames.contains(TALK_STORE)) {
        db.createObjectStore(TALK_STORE, { keyPath: "entryId" });
      }
      if (!db.objectStoreNames.contains(PEERKEY_STORE)) {
        db.createObjectStore(PEERKEY_STORE, { keyPath: "entryId" });
      }
      // 記憶装置 層1a — journal lane (keyPath recordId, not entryId).
      if (!db.objectStoreNames.contains(JOURNAL_STORE)) {
        db.createObjectStore(JOURNAL_STORE, { keyPath: "recordId" });
      }
      // 記憶装置 層2b — windowchat lane（②opt-in の会話控え・singleton）。
      if (!db.objectStoreNames.contains(WINDOWCHAT_STORE)) {
        db.createObjectStore(WINDOWCHAT_STORE, { keyPath: "entryId" });
      }
      // Device Mesh Phase A — 身元・端末鍵・epoch 鍵（private はこの端末のみ）。
      if (!db.objectStoreNames.contains(MESHID_STORE)) {
        db.createObjectStore(MESHID_STORE, { keyPath: "entryId" });
      }
      if (!db.objectStoreNames.contains(MESHDEVICE_STORE)) {
        db.createObjectStore(MESHDEVICE_STORE, { keyPath: "entryId" });
      }
      if (!db.objectStoreNames.contains(MESHEPOCH_STORE)) {
        db.createObjectStore(MESHEPOCH_STORE, { keyPath: "entryId" });
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

/** The browser-backed store. Owner-local, never networked. The key field comes
 *  from the object store's keyPath (entryId for most lanes, recordId for the
 *  journal), so the class body never names a key field. */
export class IndexedDbMeetBackend<T> implements KeyedBackend<T> {
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
