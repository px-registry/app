// previous-chain helpers.
//
// A pack may name a `previous` pack_id, forming an append-only lineage: a
// newsletter's issues, a manuscript's revisions. The chain is just hash
// links — each pack commits to its predecessor's id, so the order cannot be
// rewritten without changing every id downstream.
//
// For the current static examples a chain is usually a single link or empty;
// these helpers give the viewer the structure to render lineage when present.

import type { Pack } from "./types.ts";

/** Index a set of packs by pack_id for O(1) chain walks. */
export function indexById(packs: Pack[]): Map<string, Pack> {
  const map = new Map<string, Pack>();
  for (const pack of packs) map.set(pack.pack_id, pack);
  return map;
}

/**
 * Walk the `previous` links from `pack` back toward its genesis, returning the
 * ancestors in order from most-recent predecessor to oldest. The starting
 * pack itself is not included. Stops at the first link that is not present in
 * `index` (an out-of-set or genesis pack) and is cycle-safe.
 */
export function ancestorsOf(pack: Pack, index: Map<string, Pack>): Pack[] {
  const chain: Pack[] = [];
  const seen = new Set<string>([pack.pack_id]);
  let cursor = pack.core.previous;
  while (cursor && !seen.has(cursor)) {
    const prev = index.get(cursor);
    if (!prev) break;
    chain.push(prev);
    seen.add(cursor);
    cursor = prev.core.previous;
  }
  return chain;
}

/** True when this pack opens a chain (no predecessor). */
export function isGenesis(pack: Pack): boolean {
  return !pack.core.previous;
}
