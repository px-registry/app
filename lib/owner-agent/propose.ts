// Stage B+1 — proposal generation (pure, deterministic, owner-side).
//
// Composes (owner-local memory) × (neutral /search result sets) into typed,
// grounded proposals. Deterministic ONLY — a listing matches an interest by a
// plain case-insensitive substring of the interest label in the listing's public
// text. No fuzzy/scored/weighted matching (that would reintroduce an opaque
// score). No network, no store, no model. `thin memory → thin proposals` — never
// fabricated.

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
 * any "better match". The order carries no hidden judgment.
 */
export function composeProposals(
  memory: readonly OwnerMemoryV1[],
  resultSets: readonly ResultSet[],
): ProposalV1[] {
  const interests = memory.filter((m) => m.kind === "interest");
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
    }
  }
  return out;
}
