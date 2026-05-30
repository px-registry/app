// Stage B — owner-local memory store.
//
// The single write path for owner memory. Every create/update runs through the
// validator (so provenance is required and "ai_generated" is refused), and there
// is NO method that writes an un-validated or AI-authored entry — AI/agent code
// cannot bypass this. Nothing here calls a network: read/edit/export/delete all
// happen on the owner's device (C1/C4).

import { validateNewMemory } from "./validate.ts";
import type { MemoryBackend } from "./backend.ts";
import type { NewOwnerMemory, OwnerMemoryV1, MemoryKind } from "./types.ts";

/** What `exportAll` returns — machine-readable, provenance included, no server fields. */
export interface MemoryExportV1 {
  format: "px.owner-memory/v1";
  exportedAt: string;
  entries: OwnerMemoryV1[];
}

function defaultGenId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return `mem_${btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}`;
}

export class OwnerMemoryStore {
  private backend: MemoryBackend;
  private now: () => string;
  private genId: () => string;

  constructor(backend: MemoryBackend, opts?: { now?: () => string; genId?: () => string }) {
    this.backend = backend;
    this.now = opts?.now ?? (() => new Date().toISOString());
    this.genId = opts?.genId ?? defaultGenId;
  }

  list(): Promise<OwnerMemoryV1[]> {
    return this.backend.list();
  }
  listByKind(kind: MemoryKind): Promise<OwnerMemoryV1[]> {
    return this.backend.list().then((all) => all.filter((m) => m.kind === kind));
  }
  get(id: string): Promise<OwnerMemoryV1 | undefined> {
    return this.backend.get(id);
  }

  /**
   * Create an entry from an explicit owner submission. Throws if the candidate
   * fails validation (bad provenance / unknown kind / un-typed value) — this is
   * the line an AI-authored "fact" cannot cross.
   */
  async create(input: NewOwnerMemory): Promise<OwnerMemoryV1> {
    const result = validateNewMemory(input);
    if (!result.ok) throw new Error(`invalid memory: ${result.error}`);
    const at = this.now();
    const entry = {
      memoryId: this.genId(),
      provenance: input.provenance,
      kind: input.kind,
      value: input.value,
      createdAt: at,
      updatedAt: at,
    } as OwnerMemoryV1;
    await this.backend.put(entry);
    return entry;
  }

  /** Edit an entry's typed value (same kind). Re-validates before writing. */
  async update(id: string, value: OwnerMemoryV1["value"]): Promise<OwnerMemoryV1> {
    const existing = await this.backend.get(id);
    if (!existing) throw new Error("memory not found");
    const candidate = { kind: existing.kind, provenance: existing.provenance, value };
    const result = validateNewMemory(candidate);
    if (!result.ok) throw new Error(`invalid memory: ${result.error}`);
    const updated = { ...existing, value, updatedAt: this.now() } as OwnerMemoryV1;
    await this.backend.put(updated);
    return updated;
  }

  remove(id: string): Promise<void> {
    return this.backend.remove(id);
  }

  /** Machine-readable export of all entries — the owner's backup / migration. */
  async exportAll(): Promise<MemoryExportV1> {
    return {
      format: "px.owner-memory/v1",
      exportedAt: this.now(),
      entries: await this.backend.list(),
    };
  }

  /** Clear the entire local store. Never calls a server (PX holds no body). */
  clear(): Promise<void> {
    return this.backend.clear();
  }
}
