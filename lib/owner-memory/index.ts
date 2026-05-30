// Stage B — owner-held memory (owner-local substrate). Public API.
//
// The personal algorithm as owner-held memory: a typed, owner-authored store that
// lives in the owner's browser. PX is memory-blind — nothing here is imported by
// a server/Function, and nothing calls a network. Personalization is the
// owner-side composition of the neutral board with this local memory.

export {
  MEMORY_KINDS,
  type Provenance,
  type MemoryKind,
  type OwnerMemoryV1,
  type NewOwnerMemory,
  type SavedFilterValue,
  type PreferenceValue,
  type InterestValue,
  type NoteValue,
} from "./types.ts";

export { validateNewMemory, isValidNewMemory, type ValidationResult } from "./validate.ts";

export { type MemoryBackend, InMemoryBackend } from "./backend.ts";

export { OwnerMemoryStore, type MemoryExportV1 } from "./store.ts";

export {
  savedFilterToSearchParams,
  savedFilterToSearchPath,
  describeSavedFilter,
  isApplicableSavedFilter,
} from "./saved-filter.ts";

export { OWNER_MEMORY_BOUNDARY, type OwnerMemoryBoundary } from "./boundary.ts";

// Note: ./indexeddb.ts (IndexedDbBackend) is intentionally NOT re-exported here —
// it is DOM-only and imported directly by client components, so this barrel stays
// safe to import from node tests.
