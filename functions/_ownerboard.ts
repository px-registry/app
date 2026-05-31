// Shared helpers for the owner-publish Functions. Leading underscore = not routed.
//
// The thin D1 boundary for the first owner-WRITE lane. Same discipline as A1/A2:
// explicit columns on every statement (no SELECT *, no raw passthrough), the
// PRIVATE owner_handle read in ONE place only (ownership check) and never
// returned, all decision logic in pure lib/board (validatePublishInput). This
// file does I/O and the two security-relevant derivations only:
//   * the CSRF/Origin write guard,
//   * the server-side owner_public_ref derivation,
//   * the server-minted-id insert + the ownership-checked retire.
//
// Imports reach the top-level lib/ relatively (the Pages build bundles with
// esbuild, no "@/*" alias) — same convention as _board.ts / _transaction.ts.

import {
  newOpaqueId,
  toPublicRecord,
  isPublicSafeOwnerRef,
  assertPublicSafeOwnerRef,
  type BoardRecordV1,
  type ValidPublishRow,
} from "../lib/board/index.ts";
import { allowedOrigins, type OwnerRecord } from "./_auth.ts";

export interface BoardWriteEnv {
  /** D1 database bound in wrangler.toml ([[d1_databases]] binding = "BOARD"). */
  BOARD: D1Database;
}

// ── CSRF / Origin write guard (req 11) ────────────────────────────────────────

/**
 * A cookie-authenticated write must come from one of our own origins. The session
 * cookie is already SameSite=Lax (functions/_auth.ts), which blocks cross-site
 * POSTs; this is the defense-in-depth Origin check on top.
 *
 * Fail-closed: a browser POST that omits Origin, or carries a foreign Origin, is
 * rejected. The allowlist is the px-registry.org family + the effective origin
 * (covering a direct *.pages.dev deploy and localhost dev) — the same set the
 * WebAuthn assertion path trusts, reused so there is one definition of "our origins".
 */
export function isAllowedWriteOrigin(request: Request): boolean {
  const origin = request.headers.get("Origin");
  if (!origin) return false;
  return allowedOrigins(request).includes(origin);
}

// ── owner_public_ref derivation (req 18 — server-side, never body) ─────────────

/**
 * Derive the PUBLIC owner ref from the owner's profile / session mapping — never
 * from the request body, and never the auth handle reversibly. Prefer the owner's
 * chosen display_name when it is public-safe; otherwise fall back to the handle,
 * asserted public-safe (a pathological handle throws → the publish fails closed
 * rather than leaking a credential-shaped label). Display-name CHANGE is a
 * separate stage; this only READS the existing profile.
 */
export function deriveOwnerPublicRef(owner: OwnerRecord | null, handle: string): string {
  const dn = owner?.display_name?.trim();
  if (dn && isPublicSafeOwnerRef(dn)) return dn;
  return assertPublicSafeOwnerRef(handle);
}

// ── insert (server-minted ids, publication_state = 'public') ───────────────────

// Explicit columns — NO SELECT *, and a fixed column list on INSERT too. Every
// row is minted public; draft/owner-local state is never written (it never
// reaches the server). media_refs/category/region stay NULL (out of v0 scope).
const INSERT_SQL =
  "INSERT INTO board_records " +
  "(record_id, owner_handle, owner_public_ref, surface_shape, intent, category, region, " +
  "title, summary, media_refs, external_action_url, evidence_refs, receipt_refs, " +
  "created_at, updated_at, publication_state) " +
  "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";

/** One reconciliation pair: which owner-local draft row a minted record maps to. */
export interface PublishedRowRef {
  /** The client's localRowId, echoed back so the owner can reconcile (UI Wiring v0). */
  localRowId?: string;
  /** The server-minted record_id. */
  recordId: string;
}

/**
 * Insert an owner's published board as N public board_records rows under one
 * server-derived owner_public_ref. record_id is SERVER-MINTED per row (req 12) —
 * a body-provided id can never overwrite an existing row, because no id from the
 * body is ever bound.
 *
 * ★ all-or-nothing: every row is inserted in a single D1 `batch()`, which runs as
 * one transaction — all rows commit or none do (no partial board).
 *
 * Returns the created PUBLIC records (owner_handle never projected) AND a
 * `published` reconciliation mapping. The `localRowId` lives ONLY in that mapping
 * (echoed to its owner); it is never bound into a column and never appears in a
 * public record — so it cannot leak to D1 or to /search.
 */
export async function insertPublishedBoard(
  db: D1Database,
  args: {
    ownerHandle: string;
    ownerPublicRef: string;
    rows: ValidPublishRow[];
    localRowIds?: (string | undefined)[];
    at: string;
  },
): Promise<{ records: BoardRecordV1[]; published: PublishedRowRef[] }> {
  const built = args.rows.map((r, i) => ({
    recordId: newOpaqueId("rec"),
    row: r,
    localRowId: args.localRowIds?.[i],
  }));

  const stmts = built.map(({ recordId, row }) =>
    db
      .prepare(INSERT_SQL)
      .bind(
        recordId,
        args.ownerHandle,
        args.ownerPublicRef,
        row.surfaceShape,
        row.intent,
        null, // category — out of v0 scope
        null, // region — out of v0 scope
        row.title,
        row.summary ?? null,
        null, // media_refs — out of v0 scope (column untouched)
        row.externalActionUrl ?? null,
        "[]", // evidence_refs — empty until A2/D fills them
        "[]", // receipt_refs  — empty until A2 fills them
        args.at,
        args.at,
        "public",
      ),
  );
  await db.batch(stmts);

  // Public projection — owner_handle is never included. toPublicRecord stamps the
  // machine-readable boundary and re-sanitizes the action URL. localRowId is NOT here.
  const records = built.map(({ recordId, row }) =>
    toPublicRecord({
      recordId,
      ownerPublicRef: args.ownerPublicRef,
      surfaceShape: row.surfaceShape,
      intent: row.intent,
      title: row.title,
      ...(row.summary !== undefined ? { summary: row.summary } : {}),
      ...(row.externalActionUrl !== undefined ? { externalActionUrl: row.externalActionUrl } : {}),
      evidenceRefs: [],
      receiptRefs: [],
      createdAt: args.at,
      updatedAt: args.at,
    }),
  );

  // Reconciliation mapping — localRowId ↔ minted recordId (the only place localRowId appears).
  const published: PublishedRowRef[] = built.map(({ localRowId, recordId }) => ({
    ...(localRowId !== undefined ? { localRowId } : {}),
    recordId,
  }));

  return { records, published };
}

// ── unpublish (ownership-checked retire) ───────────────────────────────────────

/**
 * Read a row's PRIVATE owner_handle for the ownership check only. The value is
 * compared to the session handle and then discarded — it is never returned to a
 * client. Returns null when the row does not exist.
 */
export async function getRowOwnerHandle(db: D1Database, recordId: string): Promise<string | null> {
  const row = await db
    .prepare("SELECT owner_handle FROM board_records WHERE record_id = ?")
    .bind(recordId)
    .first<{ owner_handle: string }>();
  return row ? row.owner_handle : null;
}

/**
 * Retire (unpublish) a row: flip publication_state to 'retired' and stamp
 * updated_at. The CALLER must have verified ownership first (getRowOwnerHandle ===
 * session handle); this statement is keyed by record_id and changes only the one
 * row. 'retired' is allowed by the publication_state CHECK; the row stays in D1
 * but is filtered out of every public read.
 */
export async function retireRow(db: D1Database, recordId: string, at: string): Promise<void> {
  await db
    .prepare("UPDATE board_records SET publication_state = 'retired', updated_at = ? WHERE record_id = ?")
    .bind(at, recordId)
    .run();
}
