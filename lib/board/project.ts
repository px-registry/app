// Attested Board — public projection.
//
// The single, audited boundary between stored and public. `toPublicRecord` is an
// explicit allowlist over PublicBoardRow — a type that, by construction, has no
// private fields (the read path never even fetches owner_handle). It stamps the
// machine-readable boundary from the code constant and sanitizes the owner's
// external action URL, dropping anything unsafe (fail-closed).

import { MACHINE_READABLE_BOUNDARY } from "./canonical.ts";
import { sanitizeExternalActionUrl } from "./url.ts";
import type { BoardRecordV1, PublicBoardRow } from "./types.ts";

/**
 * Project a public row to its public record. Allowlist, not blocklist: only the
 * fields named below cross. The input type cannot carry owner_handle, so it is
 * unreachable here — not merely dropped. externalActionUrl is sanitized; if it
 * fails the URL policy it is omitted (no dangerous link is ever served).
 */
export function toPublicRecord(row: PublicBoardRow): BoardRecordV1 {
  const action = sanitizeExternalActionUrl(row.externalActionUrl);
  return {
    recordId: row.recordId,
    ownerPublicRef: row.ownerPublicRef,
    surfaceShape: row.surfaceShape,
    intent: row.intent,
    ...(row.category !== undefined ? { category: row.category } : {}),
    ...(row.region !== undefined ? { region: row.region } : {}),
    title: row.title,
    ...(row.summary !== undefined ? { summary: row.summary } : {}),
    ...(row.mediaRefs !== undefined ? { mediaRefs: row.mediaRefs } : {}),
    ...(action !== undefined ? { externalActionUrl: action } : {}),
    evidenceRefs: row.evidenceRefs ?? [],
    receiptRefs: row.receiptRefs ?? [],
    machineReadableBoundary: MACHINE_READABLE_BOUNDARY,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
