// Shared helpers for the A2 transaction Functions. Leading underscore = not routed.
//
// The thin D1 boundary for the record chain. The same discipline as A1: explicit
// public columns on every read (no SELECT *, no raw passthrough), private
// columns never returned, all decision logic in pure lib/board. PX writes only
// EVENT MATERIAL — there is no body/PII/payment/settlement anywhere here.
//
// owner_handle is read in ONE place only — getListingOwner — for write
// authorization (is the caller the owner?). That value is compared and then
// discarded; it is never placed in a response.

import {
  buildTransactionObject,
  planHandoffDraft,
  planContactOpened,
  planDeclaration,
  toPublicDeclaration,
  newOpaqueId,
  sanitizeExternalActionUrl,
  TRANSACTION_BOUNDARY,
  type TransactionEventV1,
  type TransactionObjectV1,
  type DeclarationRecordV1,
  type DeclarationKindV1,
  type TransactionEventKindV1,
} from "../lib/board/index.ts";

export interface BoardDbEnv {
  BOARD: D1Database;
}

// ── reads ──────────────────────────────────────────────────────────────────────

/** Resolve a listing's owner-controlled external contact (sanitized). Read-only. */
export async function resolveContactUrl(db: D1Database, recordId: string): Promise<string | null> {
  const row = await db
    .prepare("SELECT external_action_url FROM board_records WHERE record_id = ?")
    .bind(recordId)
    .first<{ external_action_url: string | null }>();
  return row ? (sanitizeExternalActionUrl(row.external_action_url) ?? null) : null;
}

interface RawEventRow {
  event_id: string;
  listing_record_id: string;
  kind: string;
  ref: string | null;
  created_at: string;
}
interface RawDeclarationRow {
  declaration_id: string;
  listing_record_id: string;
  owner_public_ref: string;
  kind: string;
  created_at: string;
}

/** The assembled transaction object + public declarations for a listing. */
export async function readTransaction(
  db: D1Database,
  recordId: string,
): Promise<{ object: TransactionObjectV1; declarations: DeclarationRecordV1[] }> {
  const eventsRes = await db
    .prepare(
      "SELECT event_id, listing_record_id, kind, ref, created_at " +
        "FROM transaction_events WHERE listing_record_id = ?",
    )
    .bind(recordId)
    .all<RawEventRow>();
  const events: TransactionEventV1[] = (eventsRes.results ?? []).map((r) => ({
    eventId: r.event_id,
    listingRecordId: r.listing_record_id,
    kind: r.kind as TransactionEventKindV1,
    ref: r.ref,
    at: r.created_at,
  }));

  // Explicit public columns — owner_handle is NOT selected.
  const declRes = await db
    .prepare(
      "SELECT declaration_id, listing_record_id, owner_public_ref, kind, created_at " +
        "FROM declarations WHERE listing_record_id = ?",
    )
    .bind(recordId)
    .all<RawDeclarationRow>();
  const declarations = (declRes.results ?? []).map((r) =>
    toPublicDeclaration({
      declarationId: r.declaration_id,
      listingRecordId: r.listing_record_id,
      ownerPublicRef: r.owner_public_ref,
      kind: r.kind as DeclarationKindV1,
      createdAt: r.created_at,
    }),
  );

  return { object: buildTransactionObject(recordId, events), declarations };
}

// ── write authorization ──────────────────────────────────────────────────────

/**
 * Internal authz read: the listing's PRIVATE owner_handle + its public ref. The
 * handle is used only to check ownership and is never returned to a client.
 */
export async function getListingOwner(
  db: D1Database,
  recordId: string,
): Promise<{ ownerHandle: string; ownerPublicRef: string } | null> {
  const row = await db
    .prepare("SELECT owner_handle, owner_public_ref FROM board_records WHERE record_id = ?")
    .bind(recordId)
    .first<{ owner_handle: string; owner_public_ref: string }>();
  return row ? { ownerHandle: row.owner_handle, ownerPublicRef: row.owner_public_ref } : null;
}

// ── writes (event material only) ───────────────────────────────────────────────

const insertEventStmt = (db: D1Database, e: TransactionEventV1) =>
  db
    .prepare(
      "INSERT INTO transaction_events (event_id, listing_record_id, kind, ref, created_at) " +
        "VALUES (?, ?, ?, ?, ?)",
    )
    .bind(e.eventId, e.listingRecordId, e.kind, e.ref, e.at);

/** Record an owner-authored contact_opened fact (no body/PII). */
export async function appendContactOpened(
  db: D1Database,
  recordId: string,
  at: string,
): Promise<TransactionEventV1> {
  const event = planContactOpened({ listingRecordId: recordId, eventId: newOpaqueId("evt"), at });
  await insertEventStmt(db, event).run();
  return event;
}

/** Record a handoff_draft_created event from an owner-controlled URL (sanitized). */
export async function appendHandoffDraft(
  db: D1Database,
  recordId: string,
  actionUrl: string,
  at: string,
): Promise<TransactionEventV1> {
  const event = planHandoffDraft({
    listingRecordId: recordId,
    actionUrl,
    eventId: newOpaqueId("evt"),
    at,
  });
  await insertEventStmt(db, event).run();
  return event;
}

/**
 * Create an owner declaration: insert the declaration, append the two events, and
 * append its opaque id to the listing's receipt_refs — all in one batch. Returns
 * the public declaration record.
 */
export async function createDeclaration(
  db: D1Database,
  args: { recordId: string; ownerHandle: string; ownerPublicRef: string; kind: DeclarationKindV1; at: string },
): Promise<DeclarationRecordV1> {
  // Read the listing's current receiptRefs (public column).
  const cur = await db
    .prepare("SELECT receipt_refs FROM board_records WHERE record_id = ?")
    .bind(args.recordId)
    .first<{ receipt_refs: string | null }>();
  let currentReceiptRefs: string[] = [];
  try {
    const parsed = JSON.parse(cur?.receipt_refs ?? "[]");
    if (Array.isArray(parsed)) currentReceiptRefs = parsed as string[];
  } catch {
    currentReceiptRefs = [];
  }

  const plan = planDeclaration({
    listingRecordId: args.recordId,
    ownerHandle: args.ownerHandle,
    ownerPublicRef: args.ownerPublicRef,
    kind: args.kind,
    currentReceiptRefs,
    ids: {
      declarationId: newOpaqueId("dec"),
      declEventId: newOpaqueId("evt"),
      attachEventId: newOpaqueId("evt"),
    },
    at: args.at,
  });

  await db.batch([
    db
      .prepare(
        "INSERT INTO declarations (declaration_id, owner_handle, listing_record_id, owner_public_ref, kind, created_at) " +
          "VALUES (?, ?, ?, ?, ?, ?)",
      )
      .bind(
        plan.declaration.declarationId,
        plan.declaration.ownerHandle,
        plan.declaration.listingRecordId,
        plan.declaration.ownerPublicRef,
        plan.declaration.kind,
        plan.declaration.createdAt,
      ),
    insertEventStmt(db, plan.events[0]),
    insertEventStmt(db, plan.events[1]),
    db
      .prepare("UPDATE board_records SET receipt_refs = ?, updated_at = ? WHERE record_id = ?")
      .bind(JSON.stringify(plan.newReceiptRefs), args.at, args.recordId),
  ]);

  return toPublicDeclaration({
    declarationId: plan.declaration.declarationId,
    listingRecordId: plan.declaration.listingRecordId,
    ownerPublicRef: plan.declaration.ownerPublicRef,
    kind: plan.declaration.kind,
    createdAt: plan.declaration.createdAt,
  });
}

export { TRANSACTION_BOUNDARY };
