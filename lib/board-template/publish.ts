// Board Templates v1 — publish projection (rides the A1 path; no new endpoint).
//
// ★ Scope line: v1 adds NO create/public-write endpoint and NO new D1 table. A
// "board" is a GROUPING of A1 BoardRecordV1 rows; publishing a draft means handing
// its rows to the EXISTING A1 publish path (a server-write extension, if ever
// needed, is a separate later stage). This module is the pure owner-side
// projection of a draft into that publish-ready, BoardRecordV1-compatible shape —
// it writes nothing and calls no network.
//
// The projection reuses the A1 constants verbatim (MACHINE_READABLE_BOUNDARY,
// sanitizeExternalActionUrl) — it does NOT mint a new boundary or a new URL policy.
// recordId / ownerPublicRef / timestamps are assigned by the server on the real
// publish; they are deliberately absent here (v1 fabricates no server identity).

import {
  MACHINE_READABLE_BOUNDARY,
  sanitizeExternalActionUrl,
  type MachineReadableBoundary,
} from "../board/index.ts";
import type { SurfaceShape, Intent } from "../board/canonical.ts";
import { meetsPublicCriteria } from "./criteria.ts";
import type { DraftBoardV1, PublicContactReadinessV1 } from "./types.ts";

/**
 * One publish-ready row — the BoardRecordV1-compatible payload the A1 publish path
 * would accept. It carries only public, owner-authored material; no draftId, no
 * templateId (C6: the template is provenance, never a public ranking/category proof),
 * no owner-local state.
 */
export interface PublishableRowV1 {
  surfaceShape: SurfaceShape;
  intent: Intent;
  title: string;
  summary?: string;
  /** From the board's contact readiness, sanitized via the A1 URL policy. */
  externalActionUrl?: string;
}

/**
 * A publish-ready board grouping. `machineReadableBoundary` is the A1 constant,
 * stamped so the projection is self-describing for an external reader — the same
 * boundary A1 stamps on every record.
 */
export interface PublishableBoardV1 {
  boardTitle: string;
  rows: PublishableRowV1[];
  machineReadableBoundary: MachineReadableBoundary;
}

/** The external URL a contact readiness exposes (sanitized), if any. manual_copy has none. */
export function readinessExternalUrl(contact: PublicContactReadinessV1 | undefined): string | undefined {
  if (!contact) return undefined;
  if (contact.kind === "manual_copy") return undefined;
  return sanitizeExternalActionUrl(contact.externalActionUrl);
}

/**
 * Project a draft into its publish-ready rows. Throws if the structural criteria
 * are not met — a draft that fails the gate has no publish projection at all
 * (empty-board prevention, §4). Pure; assigns no server identity, writes nothing.
 */
export function projectForPublish(draft: DraftBoardV1): PublishableBoardV1 {
  if (!meetsPublicCriteria(draft)) {
    throw new Error("draft does not meet the minimum public criteria");
  }
  const externalActionUrl = readinessExternalUrl(draft.contact);
  const rows: PublishableRowV1[] = draft.rows.map((r) => ({
    surfaceShape: r.surfaceShape,
    intent: r.intent,
    title: r.title,
    ...(r.summary != null ? { summary: r.summary } : {}),
    ...(externalActionUrl != null ? { externalActionUrl } : {}),
  }));
  return {
    boardTitle: draft.boardTitle,
    rows,
    machineReadableBoundary: MACHINE_READABLE_BOUNDARY,
  };
}
