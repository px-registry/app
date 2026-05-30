// Attested Board — owner declarations (A2's "receipt", renamed to material).
//
// The word "receipt" reads as payment/settlement; A2 holds neither, so the
// record is a DECLARATION: the owner's own statement that an event (a handoff,
// an exchange) took place. It is MATERIAL, not judgment — PX records that the
// owner declared it, and never asserts the transaction "completed", "settled",
// "succeeded", or was "safe". The declaration carries no body/PII: just a kind,
// the public owner label, timestamps, and an opaque id. That opaque id is what
// fills BoardRecordV1.receiptRefs (the chain connection).

import { assertPublicSafeOwnerRef } from "./owner-ref.ts";
import { TRANSACTION_BOUNDARY, planContactOpened } from "./transaction.ts";
import type { TransactionBoundary, TransactionEventV1 } from "./transaction.ts";

/** What the owner declares took place. Neutral material nouns — no judgment. */
export const DECLARATION_KINDS = ["handoff", "exchange"] as const;
export type DeclarationKindV1 = (typeof DECLARATION_KINDS)[number];

const KIND_SET: ReadonlySet<string> = new Set(DECLARATION_KINDS);
export function isDeclarationKind(v: unknown): v is DeclarationKindV1 {
  return typeof v === "string" && KIND_SET.has(v);
}

/** The stored declaration row. owner_handle is PRIVATE (mirrors A1) and is never
 *  selected into the public form. No body/PII columns exist on this shape. */
export interface StoredDeclarationRow {
  declarationId: string;
  /** PRIVATE — the declaring owner's auth handle. Never served. */
  ownerHandle: string;
  listingRecordId: string;
  ownerPublicRef: string;
  kind: DeclarationKindV1;
  createdAt: string;
}

/** A public declaration WITHOUT private fields — the only shape the read path builds. */
export type PublicDeclarationRow = Omit<StoredDeclarationRow, "ownerHandle">;

/** The public declaration record (boundary-stamped). */
export interface DeclarationRecordV1 {
  declarationId: string;
  listingRecordId: string;
  ownerPublicRef: string;
  kind: DeclarationKindV1;
  createdAt: string;
  machineReadableBoundary: TransactionBoundary;
}

/** Project a public declaration row to its public record. Allowlist + boundary. */
export function toPublicDeclaration(row: PublicDeclarationRow): DeclarationRecordV1 {
  return {
    declarationId: row.declarationId,
    listingRecordId: row.listingRecordId,
    ownerPublicRef: row.ownerPublicRef,
    kind: row.kind,
    createdAt: row.createdAt,
    machineReadableBoundary: TRANSACTION_BOUNDARY,
  };
}

/** Append a declaration id to a listing's receiptRefs (idempotent, public-safe). */
export function attachDeclarationRef(current: readonly string[], declarationId: string): string[] {
  return current.includes(declarationId) ? [...current] : [...current, declarationId];
}

/**
 * The plan for an owner declaration: the stored row to insert, the two events to
 * append (owner_declaration_created + receipt_ref_attached), and the listing's
 * new receiptRefs. Pure and deterministic — ids/timestamps are passed in, so the
 * Function generates opaque ids and this stays testable without a clock or D1.
 *
 * Guards ownerPublicRef at the write boundary (throws if not public-safe), so a
 * private handle can never enter a declaration.
 */
export function planDeclaration(args: {
  listingRecordId: string;
  ownerHandle: string;
  ownerPublicRef: string;
  kind: DeclarationKindV1;
  currentReceiptRefs: readonly string[];
  ids: { declarationId: string; declEventId: string; attachEventId: string };
  at: string;
}): {
  declaration: StoredDeclarationRow;
  events: TransactionEventV1[];
  newReceiptRefs: string[];
} {
  const ownerPublicRef = assertPublicSafeOwnerRef(args.ownerPublicRef);
  const declaration: StoredDeclarationRow = {
    declarationId: args.ids.declarationId,
    ownerHandle: args.ownerHandle,
    listingRecordId: args.listingRecordId,
    ownerPublicRef,
    kind: args.kind,
    createdAt: args.at,
  };
  const events: TransactionEventV1[] = [
    {
      eventId: args.ids.declEventId,
      listingRecordId: args.listingRecordId,
      kind: "owner_declaration_created",
      ref: args.ids.declarationId,
      at: args.at,
    },
    {
      eventId: args.ids.attachEventId,
      listingRecordId: args.listingRecordId,
      kind: "receipt_ref_attached",
      ref: args.ids.declarationId,
      at: args.at,
    },
  ];
  return {
    declaration,
    events,
    newReceiptRefs: attachDeclarationRef(args.currentReceiptRefs, args.ids.declarationId),
  };
}

// Re-export so callers building a chain have the contact planner alongside.
export { planContactOpened };
