// R1.5 meet memory — boundary metadata (Stage B lineage: lib/owner-memory/
// boundary.ts; client constant, never a server response).
//
// Every claim is TRUE because the memory body is owner-local: PX stores no
// owner memory, PX runs no model, PX does not rank. Shown in the memory UI.

export interface MeetMemoryBoundary {
  pxStoresNoOwnerMemory: true;
  memoryIsOwnerLocal: true;
  pxRunsNoModel: true;
  pxKeepsArrivalOrderOnly: true;
}

export const MEET_MEMORY_BOUNDARY: MeetMemoryBoundary = Object.freeze({
  pxStoresNoOwnerMemory: true,
  memoryIsOwnerLocal: true,
  pxRunsNoModel: true,
  pxKeepsArrivalOrderOnly: true,
});
