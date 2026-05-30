// Stage B — owner-held memory (OWNER-LOCAL substrate).
//
// The personal algorithm is OWNER-HELD: this memory body lives owner-local
// (browser IndexedDB), never on a PX server. PX is memory-blind. Memory is
// OWNER-AUTHORED — the owner writes it; PX never infers it from behavior, never
// aggregates across owners, never builds an interest graph, never ranks. The
// board (/search) stays one neutral surface; personalization is owner-side
// composition of (neutral board) × (owner-local memory).
//
// The value of each entry is TYPED by kind (a discriminated union), not freeform
// — so there is no column or path that turns this into an arbitrary body of
// counterparty PII / connector content / AI prose. `note` is the one freeform
// text kind, and it is OWNER-LOCAL ONLY (never sent to a server; see C2).

/** How an entry came to be a fact. AI proposals are NOT facts (§6). */
export type Provenance = "owner_written" | "owner_imported_confirmed";

/** The closed set of memory kinds. New kinds are added deliberately, not freely. */
export const MEMORY_KINDS = ["saved_filter", "preference", "interest", "note"] as const;
export type MemoryKind = (typeof MEMORY_KINDS)[number];

/** A saved board filter — only the A1 canonical, neutral /search params. */
export interface SavedFilterValue {
  surfaceShape?: "offered" | "auction_like" | "matching" | "stand";
  intent?: "wanted" | "offered" | "ask";
  category?: string;
  region?: string;
  query?: string;
}

/** Typed display/UX preference only — never behavior-derived. */
export interface PreferenceValue {
  displayDensity?: "compact" | "comfortable";
  defaultBoardView?: "list" | "cards";
}

/** An owner-authored interest label (a word the owner chose). */
export interface InterestValue {
  label: string;
}

/** Freeform owner note. OWNER-LOCAL ONLY — never sent to a server (C2). */
export interface NoteValue {
  text: string;
}

interface MemoryBase {
  memoryId: string;
  provenance: Provenance;
  createdAt: string;
  updatedAt: string;
}

export type OwnerMemoryV1 = MemoryBase &
  (
    | { kind: "saved_filter"; value: SavedFilterValue }
    | { kind: "preference"; value: PreferenceValue }
    | { kind: "interest"; value: InterestValue }
    | { kind: "note"; value: NoteValue }
  );

/** A new entry before it gets an id/timestamps — what a caller submits. */
export type NewOwnerMemory =
  | { kind: "saved_filter"; provenance: Provenance; value: SavedFilterValue }
  | { kind: "preference"; provenance: Provenance; value: PreferenceValue }
  | { kind: "interest"; provenance: Provenance; value: InterestValue }
  | { kind: "note"; provenance: Provenance; value: NoteValue };
