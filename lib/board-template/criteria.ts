// Board Templates v1 — minimum public criteria (STRUCTURAL gate, not judgment).
//
// ★ This is the core of "判定しない" carried to the board gate (§0/§3, C3). The gate
// is PURELY STRUCTURAL: it checks existence/count, never quality. PX does not look
// at whether a title is "good", whether a row is "valid/worthwhile", or whether a
// contact is "trustworthy". It only answers "is this board non-empty?" — the
// machine-readable condition for being a real board rather than an empty placard.
//
//   1. title       — boardTitle is non-empty (trimmed). CONTENT not judged.
//   2. row         — at least one row exists. CONTENT not judged.
//   3. contact     — a ContactKit-compatible contact readiness is set. The
//                    DESTINATION is the owner's; PX judges no trust (C2).
//
// There is no fourth, content-shaped condition anywhere in this file. Empty-board
// prevention (§4) falls straight out: a board that fails any structural condition
// cannot become public — it stays the owner's draft.

import type { DraftBoardV1 } from "./types.ts";

/** The three structural criteria, as keys (used to tell the owner what's missing). */
export type CriterionKey = "title" | "row" | "contact";

/** The result of the structural check — pass/fail plus which conditions are unmet. */
export interface CriteriaResult {
  ok: boolean;
  /** The structural conditions NOT yet met. Empty when ok. */
  missing: CriterionKey[];
}

/** #1 — the board has a title (existence, trimmed). Content is not inspected. */
function hasTitle(draft: DraftBoardV1): boolean {
  return draft.boardTitle.trim().length > 0;
}

/** #2 — at least one row exists. Count only; row content is not inspected. */
function hasRow(draft: DraftBoardV1): boolean {
  return draft.rows.length >= 1;
}

/** #3 — a contact readiness is set. Existence only; the destination is the owner's. */
function hasContact(draft: DraftBoardV1): boolean {
  return draft.contact != null;
}

/**
 * Evaluate the minimum public criteria — STRUCTURAL only. Returns which conditions
 * are unmet so the owner UI can prompt for them; it never returns a quality verdict.
 */
export function evaluatePublicCriteria(draft: DraftBoardV1): CriteriaResult {
  const missing: CriterionKey[] = [];
  if (!hasTitle(draft)) missing.push("title");
  if (!hasRow(draft)) missing.push("row");
  if (!hasContact(draft)) missing.push("contact");
  return { ok: missing.length === 0, missing };
}

/** Does the draft meet the structural criteria for the owner to be able to publish? */
export function meetsPublicCriteria(draft: DraftBoardV1): boolean {
  return evaluatePublicCriteria(draft).ok;
}
