// Stage B+1 — owner-agent proposals (owner-side, typed + grounded).
//
// The owner-agent reads OWNER-LOCAL memory and composes PROPOSALS, owner-side.
// Memory never leaves the device; PX stays memory-blind; the board stays neutral.
// A proposal is PROPOSAL-ONLY: it points at a neutral board listing and names the
// memory entry it is grounded in — an inspectable, typed causal link, NOT an
// opaque score. There is no rank/score/priority/confidence/best field anywhere
// (the proposal must never look like a PX recommendation).
//
// Leaf module: relative imports only, no store, no network, no React.

import type { SurfaceShape, Intent } from "../board/canonical.ts";

/**
 * The ONLY params the agent may turn memory into and send to the neutral
 * /search. This is the allowlist (Cbp1-1): saved_filter → these canonical
 * params; interest/note/preference NEVER become params. `query` is present only
 * when the owner explicitly applied a saved filter (never auto-sent).
 */
export interface SearchParamsAllowlist {
  // surface_shape is the A1 canonical (now the narrowed 3-value set); the type
  // is sourced from board canonical, so "matching" cannot appear here.
  surface_shape?: SurfaceShape;
  intent?: Intent;
  category?: string;
  region?: string;
  query?: string;
}

/**
 * Why a listing is proposed: a typed link to the NAMED memory entry that grounds
 * it. Two kinds only (Cbp1-3 — preference is not a basis for choosing a listing).
 * matches_saved_interest is a LOCAL deterministic match; the interest text is
 * never sent to a server.
 */
export type ProposalReason =
  | { kind: "matches_saved_filter"; memoryRef: string }
  | { kind: "matches_saved_interest"; memoryRef: string };

/**
 * One proposal. `sourceSearchParams` records which neutral /search result set it
 * came from, so the causal chain (which params → which listings → which memory)
 * is inspectable (Cbp1-2). No score/rank/priority/confidence/best — by design.
 */
export interface ProposalV1 {
  listingRecordId: string;
  reason: ProposalReason;
  sourceSearchParams: SearchParamsAllowlist;
}

/** The minimal listing shape the matcher needs (BoardRecordV1 satisfies it). */
export interface MatchableListing {
  recordId: string;
  title: string;
  summary?: string;
  category?: string;
  region?: string;
}
