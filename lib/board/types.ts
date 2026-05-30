// Attested Board — record types.
//
// Two shapes, deliberately separated:
//   StoredBoardRow  — what the board_records table holds (includes a PRIVATE
//                     owner handle used for ownership; never exposed).
//   BoardRecordV1   — the public, machine-readable record returned by /search.
//                     Strictly a projection of the stored row; carries the fixed
//                     machineReadableBoundary; carries NO pack_id (universal id
//                     is recordId — pack_id is pack-backed artifacts only, Stage C).

import type { SurfaceShape, Intent, MachineReadableBoundary } from "./canonical.ts";

/** A media reference on a record — a URL the owner published, optional hash. */
export interface BoardMediaRef {
  kind: "image";
  url: string;
  hash?: string;
}

/**
 * The public record returned by the board. Every field here is safe to serve to
 * anyone. The universal identifier is `recordId`. evidenceRefs/receiptRefs are
 * present in the type but empty in A1 — they begin to fill in Stage A2 (the
 * transaction loop) and Stage D (trust-material bundles).
 */
export interface BoardRecordV1 {
  /** Universal identifier. Present on every record. NOT a pack_id. */
  recordId: string;
  /** The owner's PUBLIC reference. Never the auth handle (see StoredBoardRow). */
  ownerPublicRef: string;
  surfaceShape: SurfaceShape;
  intent: Intent;
  category?: string;
  region?: string;
  title: string;
  summary?: string;
  mediaRefs?: BoardMediaRef[];
  /** Owner-controlled external action (N6). PX never settles/escrows it. */
  externalActionUrl?: string;
  /** Forward hooks for proof/receipt linkage. Empty in A1. */
  evidenceRefs?: string[];
  receiptRefs?: string[];
  /** Fixed, all-true. Stamped by the projection — see MACHINE_READABLE_BOUNDARY. */
  machineReadableBoundary: MachineReadableBoundary;
  createdAt: string;
  updatedAt: string;
}

/**
 * The stored row. Same content as the public record EXCEPT:
 *  - `ownerHandle` is PRIVATE (the auth identity that owns the row). It must
 *    never reach the public projection — only `ownerPublicRef` is public. This
 *    is the field the no-leak gate (9A-8) guards.
 *  - it has no machineReadableBoundary (that is a code constant, not stored).
 */
export interface StoredBoardRow {
  recordId: string;
  /** PRIVATE — the owning auth handle. Never serialized to the public record. */
  ownerHandle: string;
  ownerPublicRef: string;
  surfaceShape: SurfaceShape;
  intent: Intent;
  category?: string;
  region?: string;
  title: string;
  summary?: string;
  mediaRefs?: BoardMediaRef[];
  externalActionUrl?: string;
  evidenceRefs?: string[];
  receiptRefs?: string[];
  createdAt: string;
  updatedAt: string;
}

/** The exact set of StoredBoardRow keys that are PRIVATE — never public. */
export const PRIVATE_STORED_FIELDS = ["ownerHandle"] as const;

/**
 * A board row WITHOUT its private fields — the only shape the read path ever
 * constructs. The /search Function SELECTs explicit public columns (never
 * owner_handle), so it builds one of these directly; private data never leaves
 * D1. Both filterBoard and toPublicRecord take this type, so the private handle
 * is unreachable by construction, not merely dropped by a mapper (9A-8).
 */
export type PublicBoardRow = Omit<StoredBoardRow, (typeof PRIVATE_STORED_FIELDS)[number]>;
