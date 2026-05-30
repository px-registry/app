// Shared helpers for the board Function. Leading underscore = not routed.
//
// This is the thin D1 boundary: read PUBLIC columns, map them to the shared
// PublicBoardRow shape, then hand off to lib/board for the canonical filtering
// and the public projection. All the rules (fail-closed filters, user-selected
// sort, the sanitized action URL, the stamped boundary) live in lib/board and
// are tested there without D1 — this file only does I/O.
//
// ★ Privacy is structural, not mapper-deep: the SELECT lists explicit public
// columns and NEVER fetches owner_handle (or any internal id), so private data
// never leaves D1 (9A-8). There is no SELECT * and no raw-row passthrough.
//
// Imports are relative into the top-level lib/ (the Pages build bundles with
// esbuild, which has no "@/*" alias) — same convention as functions/_auth.ts.

import {
  parseSearchParams,
  filterBoard,
  toPublicRecord,
  type PublicBoardRow,
  type BoardMediaRef,
  type BoardRecordV1,
} from "../lib/board/index.ts";

export interface BoardEnv {
  /** D1 database bound in wrangler.toml ([[d1_databases]] binding = "BOARD"). */
  BOARD: D1Database;
}

// The PUBLIC columns the read path fetches. owner_handle is deliberately absent.
const PUBLIC_COLUMNS =
  "record_id, owner_public_ref, surface_shape, intent, category, region, " +
  "title, summary, media_refs, external_action_url, evidence_refs, " +
  "receipt_refs, created_at, updated_at";

/** The raw shape of the PUBLIC columns D1 returns (snake_case, JSON as text). */
interface RawPublicRow {
  record_id: string;
  owner_public_ref: string;
  surface_shape: string;
  intent: string;
  category: string | null;
  region: string | null;
  title: string;
  summary: string | null;
  media_refs: string | null;
  external_action_url: string | null;
  evidence_refs: string | null;
  receipt_refs: string | null;
  created_at: string;
  updated_at: string;
}

function parseJsonArray<T>(s: string | null): T[] | undefined {
  if (s == null) return undefined;
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? (v as T[]) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Map a raw public row to PublicBoardRow. surface_shape/intent are trusted to be
 * canonical because the table's CHECK constraints guarantee it; that cast is the
 * one place that trust is spent, backed by the migration (gate 9A-13). There is
 * no owner_handle to map — it was never selected.
 */
function rawToPublicRow(r: RawPublicRow): PublicBoardRow {
  const mediaRefs = parseJsonArray<BoardMediaRef>(r.media_refs);
  return {
    recordId: r.record_id,
    ownerPublicRef: r.owner_public_ref,
    surfaceShape: r.surface_shape as PublicBoardRow["surfaceShape"],
    intent: r.intent as PublicBoardRow["intent"],
    ...(r.category != null ? { category: r.category } : {}),
    ...(r.region != null ? { region: r.region } : {}),
    title: r.title,
    ...(r.summary != null ? { summary: r.summary } : {}),
    ...(mediaRefs !== undefined ? { mediaRefs } : {}),
    ...(r.external_action_url != null ? { externalActionUrl: r.external_action_url } : {}),
    evidenceRefs: parseJsonArray<string>(r.evidence_refs) ?? [],
    receiptRefs: parseJsonArray<string>(r.receipt_refs) ?? [],
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/** Result of a board search: ok with rows, or a rejected non-canonical filter. */
export type BoardSearchResult =
  | { ok: true; records: BoardRecordV1[] }
  | { ok: false; reason: "invalid_canonical" };

/**
 * Run a board search against D1 and return public records. Fetch public columns
 * + filter in lib/board is exact and simple at seed scale; the equality filters
 * move into SQL WHERE + the migration's indices when the board grows (Stage A2+).
 *
 * A non-canonical surface_shape/intent (e.g. the narrowed-out "matching") is
 * rejected explicitly — fail-closed at the param boundary — so the handler can
 * answer 400 rather than a silent empty 200 (§6).
 */
export async function queryBoard(db: D1Database, url: URL): Promise<BoardSearchResult> {
  const params = parseSearchParams(url.searchParams);
  if (params.invalid) return { ok: false, reason: "invalid_canonical" };
  const stmt = db.prepare(`SELECT ${PUBLIC_COLUMNS} FROM board_records`);
  const { results } = await stmt.all<RawPublicRow>();
  const rows = (results ?? []).map(rawToPublicRow);
  return { ok: true, records: filterBoard(rows, params).map(toPublicRecord) };
}
