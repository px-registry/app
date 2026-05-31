// Attested Board — owner publish input validation (Owner Board Publish v0, pure).
//
// The fail-closed body allowlist for POST /api/owner/board/publish. This is the
// decision layer of the first owner-WRITE lane: it validates exactly the fields
// the owner-local draft produces today — boardTitle, rows (canonical
// surface_shape + intent + title + optional summary), and a contact readiness
// that resolves to one owner-controlled externalActionUrl — and NOTHING else.
//
// What it deliberately does NOT read (req 1 / 2 / 18 — ignored even if present):
//   owner_handle, owner_public_ref, record_id, credential  → identity is the
//     server's (session + derived ref + minted id), never the body's.
//   mediaRefs, payment fields, category, region            → out of v0 scope
//     (Minimal first-write); the body simply never reads them.
//
// It is PURE (no D1, no network, no Cloudflare/React globals) so the whole gate —
// canonical 3×3, structural minimum criteria, and payload caps — is tested in node
// without a database. lib/board must not import lib/board-template (which depends
// on lib/board), so the contact-readiness kinds are restated at this layer
// boundary; they mirror lib/board-template's CONTACT_READINESS_KINDS by design.

import { isSurfaceShape, isIntent, type SurfaceShape, type Intent } from "./canonical.ts";
import { sanitizeExternalActionUrl } from "./url.ts";

/**
 * Structural size caps (req 14). These are SIZE safety only — never a judgment of
 * content. An oversized payload is rejected BEFORE any DB write; it never reaches
 * D1 as a partial row.
 */
export const PUBLISH_CAPS = {
  /** Max rows the owner may publish in one board. */
  maxRows: 20,
  /** Max length of the (gate-only) board title. */
  maxBoardTitleLen: 200,
  /** Max length of a row title. */
  maxTitleLen: 200,
  /** Max length of a row summary. */
  maxSummaryLen: 2_000,
  /** Max length of an owner-provided external action URL string. */
  maxUrlLen: 2_048,
} as const;

// The contact-readiness kinds the publish body accepts. Closed 3-set, restated
// here so lib/board stays free of a lib/board-template import (cycle avoidance);
// kept in lock-step with lib/board-template/types.ts CONTACT_READINESS_KINDS.
const CONTACT_KINDS = [
  "manual_copy",
  "public_external_link",
  "owner_provided_limited_external_invite",
] as const;
const CONTACT_KIND_SET: ReadonlySet<string> = new Set(CONTACT_KINDS);

/**
 * One validated, publish-ready row — the canonical, public-only material the
 * insert path will store. NO owner identity, NO record_id: those are assigned by
 * the server (session handle, derived public ref, minted record_id). The
 * board-level externalActionUrl (from the contact readiness, already sanitized)
 * is applied to every row, exactly as the owner-local projection does.
 */
export interface ValidPublishRow {
  surfaceShape: SurfaceShape;
  intent: Intent;
  title: string;
  summary?: string;
  externalActionUrl?: string;
}

/** Every reason the publish body can be rejected — fail-closed, explicit (no silent pass). */
export type PublishReject =
  | "empty_body"
  | "title_required" // criterion #1 (boardTitle missing/blank)
  | "title_too_long"
  | "rows_required" // criterion #2 (no rows)
  | "too_many_rows"
  | "invalid_row"
  | "non_canonical" // surface_shape / intent outside the closed 3×3
  | "row_title_too_long"
  | "summary_too_long"
  | "url_too_long"
  | "contact_required" // criterion #3 (no contact readiness)
  | "invalid_contact";

export type PublishValidation =
  | { ok: true; rows: ValidPublishRow[] }
  | { ok: false; reason: PublishReject };

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

/**
 * Resolve the board's contact readiness to a single owner-controlled action URL.
 *
 * Returns:
 *   { present: true, url }      — a valid contact kind (url may be undefined for
 *                                 manual_copy, or when a provided URL is unsafe and
 *                                 sanitized out — fail-closed omit, never a verdict).
 *   { present: false }          — no contact set (criterion #3 unmet).
 *   "too_long" / "invalid"      — a hard reject reason.
 *
 * Mirrors the owner-local gate: contact "present" means a valid KIND is set; URL
 * safety only governs whether an action link is attached, it is never quality-judged.
 */
function resolveContact(
  contact: unknown,
): { present: true; url?: string } | { present: false } | "too_long" | "invalid" {
  if (contact == null) return { present: false };
  if (!isObject(contact)) return "invalid";
  const kind = contact.kind;
  if (typeof kind !== "string" || !CONTACT_KIND_SET.has(kind)) return "invalid";
  if (kind === "manual_copy") return { present: true };
  // public_external_link / owner_provided_limited_external_invite carry a URL.
  const raw = contact.externalActionUrl;
  if (typeof raw !== "string") return { present: true }; // kind set, no usable link
  if (raw.length > PUBLISH_CAPS.maxUrlLen) return "too_long";
  // sanitizeExternalActionUrl drops anything unsafe (javascript:/relative/etc) →
  // the board is published with no action link rather than a dangerous one.
  const url = sanitizeExternalActionUrl(raw);
  return url !== undefined ? { present: true, url } : { present: true };
}

/**
 * Validate a publish body. Fail-closed: returns the validated public rows, or the
 * first reason it is rejected. The structural minimum criteria (title + ≥1 row +
 * contact) are RE-CHECKED here on the server — the owner-local gate is never
 * trusted (req 5 / 8). All identity-bearing fields in the body are ignored.
 */
export function validatePublishInput(raw: unknown): PublishValidation {
  if (!isObject(raw)) return { ok: false, reason: "empty_body" };

  // Criterion #1 — board title (existence + size only; content never judged).
  const boardTitle = raw.boardTitle;
  if (typeof boardTitle !== "string" || boardTitle.trim().length === 0) {
    return { ok: false, reason: "title_required" };
  }
  if (boardTitle.length > PUBLISH_CAPS.maxBoardTitleLen) {
    return { ok: false, reason: "title_too_long" };
  }

  // Criterion #2 — at least one row, capped count.
  const rawRows = raw.rows;
  if (!Array.isArray(rawRows) || rawRows.length === 0) {
    return { ok: false, reason: "rows_required" };
  }
  if (rawRows.length > PUBLISH_CAPS.maxRows) {
    return { ok: false, reason: "too_many_rows" };
  }

  // Criterion #3 — a contact readiness is set; resolve its single action URL.
  const contact = resolveContact(raw.contact);
  if (contact === "too_long") return { ok: false, reason: "url_too_long" };
  if (contact === "invalid") return { ok: false, reason: "invalid_contact" };
  if (!contact.present) return { ok: false, reason: "contact_required" };
  const externalActionUrl = contact.url;

  const rows: ValidPublishRow[] = [];
  for (const r of rawRows) {
    if (!isObject(r)) return { ok: false, reason: "invalid_row" };
    // Canonical 3×3 — outside the closed set is rejected (never widened).
    if (!isSurfaceShape(r.surfaceShape) || !isIntent(r.intent)) {
      return { ok: false, reason: "non_canonical" };
    }
    if (typeof r.title !== "string" || r.title.trim().length === 0) {
      return { ok: false, reason: "invalid_row" };
    }
    if (r.title.length > PUBLISH_CAPS.maxTitleLen) {
      return { ok: false, reason: "row_title_too_long" };
    }
    let summary: string | undefined;
    if (r.summary != null) {
      if (typeof r.summary !== "string") return { ok: false, reason: "invalid_row" };
      if (r.summary.length > PUBLISH_CAPS.maxSummaryLen) {
        return { ok: false, reason: "summary_too_long" };
      }
      summary = r.summary;
    }
    rows.push({
      surfaceShape: r.surfaceShape,
      intent: r.intent,
      title: r.title,
      ...(summary !== undefined ? { summary } : {}),
      ...(externalActionUrl !== undefined ? { externalActionUrl } : {}),
    });
  }

  return { ok: true, rows };
}
