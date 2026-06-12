// R1.5 meet memory — storage backend (Stage B lineage: lib/owner-memory/backend.ts).
//
// An async id→entry store. The browser uses the IndexedDB backend
// (./indexeddb.ts); tests use the in-memory backend below. Store logic
// (validation, provenance, export/import, clear) is backend-agnostic, so all of
// it is exercised in node without a browser. No backend talks to a network —
// the memory body never leaves the owner's device.

import type { MeetMemoryEntryV1 } from "./types.ts";

/** Generic id→record store; the memory substrate and the received shelf each
 *  get their own typed instance (separate object stores, same discipline). */
export interface KeyedBackend<T extends { entryId: string }> {
  list(): Promise<T[]>;
  get(id: string): Promise<T | undefined>;
  put(entry: T): Promise<void>;
  remove(id: string): Promise<void>;
  clear(): Promise<void>;
}

/** The memory substrate's backend type. */
export type MeetBackend = KeyedBackend<MeetMemoryEntryV1>;

/** Process-local backend for tests (and a safe SSR no-op fallback). */
export class InMemoryKeyedBackend<T extends { entryId: string }> implements KeyedBackend<T> {
  private map = new Map<string, T>();

  async list(): Promise<T[]> {
    return [...this.map.values()];
  }
  async get(id: string): Promise<T | undefined> {
    return this.map.get(id);
  }
  async put(entry: T): Promise<void> {
    this.map.set(entry.entryId, entry);
  }
  async remove(id: string): Promise<void> {
    this.map.delete(id);
  }
  async clear(): Promise<void> {
    this.map.clear();
  }
}

/** Back-compat alias for the memory substrate's in-memory backend. */
export class InMemoryMeetBackend extends InMemoryKeyedBackend<MeetMemoryEntryV1> {}
