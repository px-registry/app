// Board Templates v1 — owner-local scaffold types (OWNER-LOCAL, like Stage B).
//
// ★ Scope (locked, supersedes clarifications C1): v1 is an OWNER-LOCAL scaffold
// only. A draft board lives in the owner's browser (IndexedDB, the same
// device-local substrate as Stage B memory). PX holds no draft and no board/draft
// state — the server stays board-state-blind, the memory-blind line extended.
// Publishing rides the A1 publish path; v1 adds NO create/public-write endpoint
// and NO new D1 table (a public-write extension, if ever needed, is a later stage).
//
// Two shapes, deliberately separated, mirroring the A1 split:
//   BoardTemplateV1  — a SCAFFOLD: a canonical-compliant starting point the owner
//                      may edit, ignore, or start blank without. NOT a prescription,
//                      NOT a PX "good board". PX ranks none of them.
//   DraftBoardV1     — the owner's own draft, held owner-local. It carries a
//                      publicationState the OWNER declares; PX never auto-publishes.
//
// Leaf module: relative imports only, no React, no Cloudflare globals, no network —
// so node tests and the app layer import it unchanged (same convention as
// lib/board/canonical.ts).

import type { SurfaceShape, Intent } from "../board/canonical.ts";

// ── Template (scaffold) ─────────────────────────────────────────────────────────

/**
 * One suggested row on a template — a canonical-shaped starting point. `titleHint`
 * is a PLACEHOLDER only (C6): it is shown in the draft UI as the input placeholder
 * and is NEVER auto-filled into a stored draft title. The owner writes their own
 * words; PX copy is never left behind in a published row.
 */
export interface TemplateSuggestedRow {
  surfaceShape: SurfaceShape; // Canonical 3 (offered / auction_like / stand)
  intent: Intent; // Canonical 3 (wanted / offered / ask)
  titleHint: string; // placeholder example, owner-rewritten — never a stored title
}

/**
 * A board template — a SCAFFOLD, not a prescription. There is deliberately NO
 * rank / score / priority / featured / recommended field: PX attaches no ordering
 * judgment to templates (§5). `useCaseLabel` is a guide ("a starting point like
 * this exists"), never a "best for you" claim.
 */
export interface BoardTemplateV1 {
  templateId: string;
  useCaseLabel: string; // a guide, not a judgment
  suggestedRows: TemplateSuggestedRow[];
}

// ── Contact readiness (C2 — ContactKit-compatible, structural only) ──────────────

/**
 * Whether the owner is ready to be contacted — a STRUCTURAL readiness condition,
 * never contact/message CONTENT (C2). This is the ContactKit-compatible shape:
 * `externalActionUrl` is the existing A1/A2 owner-controlled public material that
 * flows through the Contact Kit interstitial. There is NO PX inbox, relay, message
 * body, counterparty handle, or server-side approval queue here — by construction.
 */
export type PublicContactReadinessV1 =
  | { kind: "manual_copy" }
  | { kind: "public_external_link"; externalActionUrl: string }
  | { kind: "owner_provided_limited_external_invite"; externalActionUrl: string };

/** The contact-readiness kinds, as a closed set (mirrors ContactKit's ContactPolicy). */
export const CONTACT_READINESS_KINDS = [
  "manual_copy",
  "public_external_link",
  "owner_provided_limited_external_invite",
] as const;
export type ContactReadinessKind = (typeof CONTACT_READINESS_KINDS)[number];

// ── Draft board (owner-local) ────────────────────────────────────────────────────

/** Publication state — OWNER-DECLARED (C3). Exactly two states; PX never flips it. */
export const PUBLICATION_STATES = ["draft", "public"] as const;
export type PublicationState = (typeof PUBLICATION_STATES)[number];

/**
 * One row the owner is articulating ("what I'm collecting"). Canonical-typed on
 * both axes — a row is a CONCRETE slot (a chosen surface_shape + intent), which is
 * the structural answer to "誰か来て" emptiness (§4). The `title` is the owner's
 * own words; its CONTENT is never judged (only its existence is, in the gate).
 */
export interface DraftBoardRow {
  rowId: string;
  surfaceShape: SurfaceShape;
  intent: Intent;
  title: string; // owner-authored; never a leftover titleHint (C6)
  summary?: string;
}

/**
 * The owner's draft board, held OWNER-LOCAL (IndexedDB). PX stores none of this.
 * `templateId` is provenance only — which scaffold the owner started from — and is
 * NEVER used as a ranking/category proof on a public record (C6). `publicationState`
 * is owner-declared and may only become "public" once the structural criteria pass.
 */
export interface DraftBoardV1 {
  draftId: string;
  boardTitle: string;
  rows: DraftBoardRow[];
  contact?: PublicContactReadinessV1;
  templateId?: string;
  publicationState: PublicationState;
  createdAt: string;
  updatedAt: string;
}

/** A new draft before it gets an id/timestamps/state — what `create` accepts. */
export interface NewDraftBoard {
  boardTitle: string;
  rows: NewDraftBoardRow[];
  contact?: PublicContactReadinessV1;
  templateId?: string;
}

/** A new row before it gets a rowId. */
export interface NewDraftBoardRow {
  surfaceShape: SurfaceShape;
  intent: Intent;
  title: string;
  summary?: string;
}
