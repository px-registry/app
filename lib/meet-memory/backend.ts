// R1.5 meet memory — storage backend (Stage B lineage: lib/owner-memory/backend.ts).
//
// An async id→entry store. The browser uses the IndexedDB backend
// (./indexeddb.ts); tests use the in-memory backend below. Store logic
// (validation, provenance, export/import, clear) is backend-agnostic, so all of
// it is exercised in node without a browser. No backend talks to a network —
// the memory body never leaves the owner's device.

import type { MeetMemoryEntryV1 } from "./types.ts";

export interface MeetBackend {
  list(): Promise<MeetMemoryEntryV1[]>;
  get(id: string): Promise<MeetMemoryEntryV1 | undefined>;
  put(entry: MeetMemoryEntryV1): Promise<void>;
  remove(id: string): Promise<void>;
  clear(): Promise<void>;
}

/** Process-local backend for tests (and a safe SSR no-op fallback). */
export class InMemoryMeetBackend implements MeetBackend {
  private map = new Map<string, MeetMemoryEntryV1>();

  async list(): Promise<MeetMemoryEntryV1[]> {
    return [...this.map.values()];
  }
  async get(id: string): Promise<MeetMemoryEntryV1 | undefined> {
    return this.map.get(id);
  }
  async put(entry: MeetMemoryEntryV1): Promise<void> {
    this.map.set(entry.entryId, entry);
  }
  async remove(id: string): Promise<void> {
    this.map.delete(id);
  }
  async clear(): Promise<void> {
    this.map.clear();
  }
}
