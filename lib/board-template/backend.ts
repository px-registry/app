// Board Templates v1 — draft storage backend (owner-local, like Stage B).
//
// An async key→draft store. The browser uses the IndexedDB backend
// (./indexeddb.ts); tests use the in-memory backend below. The store logic
// (validation, the structural publish gate, the lifecycle) is backend-agnostic, so
// all of it runs in node without a browser. No backend talks to a network — a
// draft never leaves the owner's device (the memory-blind line extended to drafts).

import type { DraftBoardV1 } from "./types.ts";

export interface DraftBackend {
  list(): Promise<DraftBoardV1[]>;
  get(id: string): Promise<DraftBoardV1 | undefined>;
  put(draft: DraftBoardV1): Promise<void>;
  remove(id: string): Promise<void>;
  clear(): Promise<void>;
}

/** Process-local backend for tests (and a safe SSR no-op fallback). */
export class InMemoryDraftBackend implements DraftBackend {
  private map = new Map<string, DraftBoardV1>();

  async list(): Promise<DraftBoardV1[]> {
    return [...this.map.values()];
  }
  async get(id: string): Promise<DraftBoardV1 | undefined> {
    return this.map.get(id);
  }
  async put(draft: DraftBoardV1): Promise<void> {
    this.map.set(draft.draftId, draft);
  }
  async remove(id: string): Promise<void> {
    this.map.delete(id);
  }
  async clear(): Promise<void> {
    this.map.clear();
  }
}
