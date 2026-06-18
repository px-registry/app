// PX Memory v0.1 — barrel。Owner-local・append-only な記憶基層（隔離 lane）。
// 設計正本: docs/r2/px-memory-v01.md。

export * from "./types.ts";
export {
  nextSeq,
  orderBySeq,
  createMemoryEvent,
  createMemoryItemFromEvent,
  moveMemoryToSurface,
  stowMemoryDeep,
  removeMemoryFromRun,
  forgetMemory,
  foldMemoryItems,
} from "./memory.ts";
export type { EventCtx, MemoryMutation } from "./memory.ts";
export { createMemoryProjection } from "./projection.ts";
export type { ProjectionCtx } from "./projection.ts";
export { applyReadGate, buildRunMemoryPacket } from "./read-gate.ts";
export { createAntennaContextDraft } from "./antenna.ts";
export type { AntennaCtx } from "./antenna.ts";
export { InMemoryBackend, PxMemoryStore } from "./store.ts";
export type { MemoryBackend, PxMemoryStoreOpts } from "./store.ts";
export { PX_MEMORY_COPY, PX_MEMORY_FORBIDDEN_OWNER_WORDS } from "./copy.ts";
