// Stage B — owner-memory storage backend.
//
// An async key→entry store. The browser uses the IndexedDB backend
// (./indexeddb.ts); tests use the in-memory backend below. The store logic
// (validation, provenance, export, clear) is backend-agnostic, so all of it is
// exercised in node without a browser. No backend talks to a network — the
// memory body never leaves the owner's device (C1).

import type { OwnerMemoryV1 } from "./types.ts";

export interface MemoryBackend {
  list(): Promise<OwnerMemoryV1[]>;
  get(id: string): Promise<OwnerMemoryV1 | undefined>;
  put(entry: OwnerMemoryV1): Promise<void>;
  remove(id: string): Promise<void>;
  clear(): Promise<void>;
}

/** Process-local backend for tests (and a safe SSR no-op fallback). */
export class InMemoryBackend implements MemoryBackend {
  private map = new Map<string, OwnerMemoryV1>();

  async list(): Promise<OwnerMemoryV1[]> {
    return [...this.map.values()];
  }
  async get(id: string): Promise<OwnerMemoryV1 | undefined> {
    return this.map.get(id);
  }
  async put(entry: OwnerMemoryV1): Promise<void> {
    this.map.set(entry.memoryId, entry);
  }
  async remove(id: string): Promise<void> {
    this.map.delete(id);
  }
  async clear(): Promise<void> {
    this.map.clear();
  }
}
