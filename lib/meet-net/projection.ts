// R1.5/R2 — the OUTBOUND public projection. The single path a memory item takes
// to leave the device, and it runs through the FROZEN rig core gate:
// buildPublicPool is fail-closed (private !== false never passes; explicit
// field pick — no spread, no ride-along fields), so a private item cannot be
// published even by a UI bug upstream of this call.
//
// R2 0010: each row carries its device-minted public alias (itemRef). The alias
// is attached HERE, deliberately, AFTER the rig gate — it is random and
// content-free (minted in lib/meet-memory/alias.ts), so it opens no ride-along
// channel; the rig core itself stays frozen. Per-item gating (one item in →
// zero or one row out) keeps the alias↔row pairing explicit, never a zip guess.

import { buildPublicPool, type RigMemoryItemV1 } from "../rig/rig.ts";

export type OutboundPoolItem = {
  /** R2 0010: the item's stable public alias — never a raw internal id. */
  itemRef: string;
  kind: string;
  title: string;
  text: string;
  tags: string[];
  position: number;
  /** R2 0012: ビジネス旗 — owner の自己申告（boolean 一枚・素通し）。 */
  business: boolean;
};

/** One projectable entry: the PUBLIC VIEW of an item + its minted alias + 旗. */
export type ProjectableEntry = {
  itemRef: string;
  view: RigMemoryItemV1;
  /** R2 0012 — meet-memory 層の旗（rig core の外・明示的に運ぶ）。省略 = false。 */
  business?: boolean;
};

const SELF = "self";

/**
 * Project the owner's items to exactly what may be published. Returns the
 * closed set {itemRef,kind,title,text,tags,position} — no private flag, no
 * token, no internal id. Order is input order (arrival order only).
 */
export function buildOutboundProjection(entries: ProjectableEntry[]): OutboundPoolItem[] {
  const out: OutboundPoolItem[] = [];
  for (const { itemRef, view, business } of entries) {
    const pool = buildPublicPool([{ ownerId: SELF, items: [view] }], {
      ownerRefById: new Map([[SELF, SELF]]),
    });
    if (pool.length === 0) continue; // the rig gate dropped it (private !== false)
    const p = pool[0];
    out.push({
      itemRef,
      kind: p.kind,
      title: p.title,
      text: p.text,
      tags: [...p.tags],
      position: out.length,
      business: business === true,
    });
  }
  return out;
}
