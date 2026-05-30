// Attested Board — routable paths.
//
// Records live in D1 (dynamic), so the detail surface cannot be a statically
// pre-rendered [recordId] route under `output: export`. It is one static page
// that reads the id from the query string — so every row routes to a real public
// surface (gate 9A-7) without build-time enumeration.

import type { BoardRecordV1, StoredBoardRow } from "./types.ts";

/** The board surface (the /search UI). trailingSlash per next.config. */
export const BOARD_SEARCH_PATH = "/search/";

/** The public detail surface for one record. Always routable, query-param based. */
export function boardDetailPath(
  record: Pick<BoardRecordV1 | StoredBoardRow, "recordId">,
): string {
  return `/board/?id=${encodeURIComponent(record.recordId)}`;
}
