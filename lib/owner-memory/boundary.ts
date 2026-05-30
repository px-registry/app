// Stage B — owner-memory boundary metadata (SEPARATE from A1/A2; client constant).
//
// ★ C3 (supersedes v2 §7): the A1/A2 machineReadableBoundary objects on the
// /search, /board, transaction, and declaration responses are NOT changed — they
// stay byte-identical. B's posture is declared HERE instead, as a standalone
// client constant (B is owner-local, so a client constant is the natural home).
// It is shown in the owner-memory UI; it never mutates a server response.
//
// Every claim is TRUE because the memory body is owner-local: PX stores no owner
// memory, memory is owner-local, PX does not rank/recommend, PX builds no
// interest graph. (memoryIsOwnerHeld would also be true — owner-authored AND
// owner-possessed — but we keep the keys concrete.)

export interface OwnerMemoryBoundary {
  pxStoresNoOwnerMemory: true;
  memoryIsOwnerLocal: true;
  pxDoesNotRankOrRecommend: true;
  pxBuildsNoInterestGraph: true;
}

export const OWNER_MEMORY_BOUNDARY: OwnerMemoryBoundary = Object.freeze({
  pxStoresNoOwnerMemory: true,
  memoryIsOwnerLocal: true,
  pxDoesNotRankOrRecommend: true,
  pxBuildsNoInterestGraph: true,
});
