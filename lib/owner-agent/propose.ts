// Stage B+1 — proposal generation (pure, deterministic, owner-side).
//
// Composes (owner-local memory) × (neutral /search result sets) into typed,
// grounded proposals. Deterministic ONLY — a listing matches an interest by a
// plain case-insensitive substring of the interest label in the listing's public
// text. No fuzzy/scored/weighted matching (that would reintroduce an opaque
// score). No network, no store, no model. `thin memory → thin proposals` — never
// fabricated.

import { isIntent } from "../board/canonical.ts";
import type { Intent, SurfaceShape } from "../board/canonical.ts";
import type { OwnerMemoryV1 } from "../owner-memory/index.ts";
import type { MatchableListing, ProposalV1, SearchParamsAllowlist } from "./types.ts";

/** One neutral /search result set the agent fetched, owner-side. */
export interface ResultSet {
  /** Set when this set came from a specific saved_filter; absent for the whole board. */
  savedFilterId?: string;
  params: SearchParamsAllowlist;
  listings: MatchableListing[];
}

/** Deterministic: does the interest label appear in the listing's public text? */
export function listingMatchesInterest(listing: MatchableListing, label: string): boolean {
  const needle = label.trim().toLowerCase();
  if (!needle) return false;
  const hay = [listing.title, listing.summary, listing.category, listing.region]
    .filter((s): s is string => typeof s === "string")
    .join("\n")
    .toLowerCase();
  return hay.includes(needle);
}

function key(p: ProposalV1): string {
  return `${p.listingRecordId}|${p.reason.kind}|${p.reason.memoryRef}`;
}

// ── #4 cross-intent (the meeting working, non-ranking) ──────────────────────────

/** A complementary listing shape to surface as a candidate: an intent, optionally
 *  pinned to a surface_shape (e.g. a `stand` gathering). */
interface IntentTarget {
  intent: Intent;
  surfaceShape?: SurfaceShape;
}

/**
 * The cross-intent complement table (C1). The owner's saved position (a
 * saved_filter's intent) → the intents whose listings are candidates to MEET it.
 *
 * ★ Deliberately ASYMMETRIC, so the narrowed-out "matching" reading does not
 * return: `offered` draws only `wanted` (never `ask` — an inquiry is not a
 * fulfilled offer), and `wanted` additionally draws `stand.ask` (open-call /
 * gathering material). It is a fixed lookup — no score, no weighting, no ranking.
 */
const CROSS_INTENT_TARGETS: Record<Intent, readonly IntentTarget[]> = {
  wanted: [{ intent: "offered" }, { intent: "ask", surfaceShape: "stand" }, { intent: "offered", surfaceShape: "stand" }],
  offered: [{ intent: "wanted" }],
  ask: [{ intent: "offered" }, { intent: "offered", surfaceShape: "stand" }],
};

/** Does the listing satisfy a complement target? Exact equality only — no fuzz. */
function listingMeetsTarget(listing: MatchableListing, target: IntentTarget): boolean {
  if (listing.intent !== target.intent) return false;
  if (target.surfaceShape !== undefined && listing.surfaceShape !== target.surfaceShape) return false;
  return true;
}

/**
 * Is `listing` a cross-intent candidate for a saved_filter whose owner position is
 * `ownerIntent`, within the filter's scope? The filter's own category/region (when
 * present) scope the candidates so the proposal stays grounded in what the owner
 * saved — never the whole opposite side of the board. The listing's OWN intent must
 * differ from the owner's (a same-intent listing is not a meeting).
 *
 * ★ Fail-closed on the listing side too (mirrors the saved_filter side): a listing
 * MISSING either canonical axis takes no part in cross-intent. PX never infers an
 * intent/surface_shape from title/category/summary and never defaults a missing one
 * — an unlabelled listing is simply not a candidate.
 */
function listingIsCrossIntentCandidate(
  listing: MatchableListing,
  ownerIntent: Intent,
  scope: { category?: string; region?: string },
): boolean {
  if (listing.intent === undefined || listing.surfaceShape === undefined) return false;
  if (listing.intent === ownerIntent) return false;
  if (scope.category && listing.category !== scope.category) return false;
  if (scope.region && listing.region !== scope.region) return false;
  return CROSS_INTENT_TARGETS[ownerIntent].some((t) => listingMeetsTarget(listing, t));
}

/**
 * Compose proposals from owner memory and the fetched result sets. For a set that
 * came from a saved_filter, each listing is grounded in that filter. For every
 * set, each listing matching an interest label is grounded in that interest.
 * Deduped by (listing, reason kind, memory entry).
 *
 * ★ Ordering is NOT a ranking. Proposals come out in the neutral board order —
 * result-set order, then the listing order /search returned (non-matches are
 * dropped, matches are never reordered). There is NO sort: not by match count,
 * not by memory recency, not by substring position, not by reason kind, not by
 * any "better match". The order carries no hidden judgment. The cross-intent pass
 * obeys the SAME neutral order — it adds reasons within a listing, never reorders.
 */
export function composeProposals(
  memory: readonly OwnerMemoryV1[],
  resultSets: readonly ResultSet[],
): ProposalV1[] {
  const interests = memory.filter((m) => m.kind === "interest");
  // saved_filter entries that declare an owner position (a canonical intent) ground
  // the cross-intent pass. A stale/non-canonical intent is skipped (fail-closed).
  const positions = memory.filter(
    (m): m is Extract<OwnerMemoryV1, { kind: "saved_filter" }> =>
      m.kind === "saved_filter" && isIntent(m.value.intent),
  );
  const out: ProposalV1[] = [];
  const seen = new Set<string>();
  const push = (p: ProposalV1) => {
    const k = key(p);
    if (!seen.has(k)) {
      seen.add(k);
      out.push(p);
    }
  };

  for (const set of resultSets) {
    for (const listing of set.listings) {
      if (set.savedFilterId) {
        push({
          listingRecordId: listing.recordId,
          reason: { kind: "matches_saved_filter", memoryRef: set.savedFilterId },
          sourceSearchParams: set.params,
        });
      }
      for (const interest of interests) {
        const label = (interest.value as { label: string }).label;
        if (listingMatchesInterest(listing, label)) {
          push({
            listingRecordId: listing.recordId,
            reason: { kind: "matches_saved_interest", memoryRef: interest.memoryId },
            sourceSearchParams: set.params,
          });
        }
      }
      for (const position of positions) {
        const ownerIntent = position.value.intent as Intent; // guarded by isIntent above
        if (
          listingIsCrossIntentCandidate(listing, ownerIntent, {
            category: position.value.category,
            region: position.value.region,
          })
        ) {
          push({
            listingRecordId: listing.recordId,
            reason: { kind: "cross_intent_candidate", memoryRef: position.memoryId },
            sourceSearchParams: set.params,
          });
        }
      }
    }
  }
  return out;
}
