// Attested Board — transaction events (the record chain).
//
// A2 connects A1's listings into a loop: contact → handoff draft → owner
// declaration → receipt ref. The chain is EVENT MATERIAL only — facts that
// something was recorded — never message body, PII, payment, settlement, or a
// completion judgment. The event kinds are deliberately non-judgment (§3): there
// is no "completed"/"settled"/"paid"/"safe" status, because PX does not decide
// whether a transaction succeeded; the owner does, off-platform.
//
// Leaf module: relative imports only, no React/Cloudflare globals.

import { MACHINE_READABLE_BOUNDARY } from "./canonical.ts";
import { sanitizeExternalActionUrl } from "./url.ts";
import type { MachineReadableBoundary } from "./canonical.ts";

/** The fixed, non-judgment event vocabulary. Never grows a status kind. */
export const TRANSACTION_EVENT_KINDS = [
  "contact_opened",
  "handoff_draft_created",
  "owner_declaration_created",
  "receipt_ref_attached",
] as const;
export type TransactionEventKindV1 = (typeof TRANSACTION_EVENT_KINDS)[number];

const EVENT_KIND_SET: ReadonlySet<string> = new Set(TRANSACTION_EVENT_KINDS);
export function isTransactionEventKind(v: unknown): v is TransactionEventKindV1 {
  return typeof v === "string" && EVENT_KIND_SET.has(v);
}

/**
 * The transaction boundary — A1's boundary PLUS the A2-specific claim that PX
 * does not hold or broker the message body. Stamped on transaction/declaration
 * responses (NOT on A1 listing records — that boundary stays byte-compatible).
 */
export interface TransactionBoundary extends MachineReadableBoundary {
  pxDoesNotHoldMessageBody: true;
}
export const TRANSACTION_BOUNDARY: TransactionBoundary = Object.freeze({
  ...MACHINE_READABLE_BOUNDARY,
  pxDoesNotHoldMessageBody: true,
});

/**
 * One event in a listing's chain. Public-safe by construction: an opaque
 * eventId, the public listing id, a non-judgment kind, and an optional opaque
 * `ref` (a declaration id, or a sanitized owner-controlled URL for a handoff
 * draft). There is NO counterparty, body, email, or phone field — by design.
 */
export interface TransactionEventV1 {
  eventId: string;
  listingRecordId: string;
  kind: TransactionEventKindV1;
  ref: string | null;
  at: string;
}

/** The assembled chain for one listing — the public transaction object. */
export interface TransactionObjectV1 {
  listingRecordId: string;
  events: TransactionEventV1[];
  /** Public-safe opaque declaration ids = exactly the listing's receiptRefs. */
  declarationRefs: string[];
  machineReadableBoundary: TransactionBoundary;
}

/**
 * Assemble events into a public transaction object. Pure: orders events by time,
 * derives declarationRefs from receipt_ref_attached events, stamps the boundary.
 */
export function buildTransactionObject(
  listingRecordId: string,
  events: readonly TransactionEventV1[],
): TransactionObjectV1 {
  const ordered = [...events]
    .filter((e) => e.listingRecordId === listingRecordId)
    .sort((a, b) => a.at.localeCompare(b.at) || a.eventId.localeCompare(b.eventId));
  const declarationRefs: string[] = [];
  for (const e of ordered) {
    if (e.kind === "receipt_ref_attached" && e.ref && !declarationRefs.includes(e.ref)) {
      declarationRefs.push(e.ref);
    }
  }
  return {
    listingRecordId,
    events: ordered,
    declarationRefs,
    machineReadableBoundary: TRANSACTION_BOUNDARY,
  };
}

/** Plan a contact_opened event (owner-authored material; no body/PII). */
export function planContactOpened(args: {
  listingRecordId: string;
  eventId: string;
  at: string;
}): TransactionEventV1 {
  return {
    eventId: args.eventId,
    listingRecordId: args.listingRecordId,
    kind: "contact_opened",
    ref: null,
    at: args.at,
  };
}

/**
 * Plan a handoff_draft_created event. The handoff is an owner-controlled
 * external action ONLY (a sanitized URL) — PX hosts no delivery, controls no
 * access, executes nothing, verifies no completion (§5). Throws if the URL is
 * not a safe http/https owner link.
 */
export function planHandoffDraft(args: {
  listingRecordId: string;
  actionUrl: string;
  eventId: string;
  at: string;
}): TransactionEventV1 {
  const safe = sanitizeExternalActionUrl(args.actionUrl);
  if (!safe) throw new Error("handoff draft requires a safe http/https owner URL");
  return {
    eventId: args.eventId,
    listingRecordId: args.listingRecordId,
    kind: "handoff_draft_created",
    ref: safe,
    at: args.at,
  };
}
