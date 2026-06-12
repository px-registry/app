// R1.5 — the OUTBOUND public projection. The single path a memory item takes to
// leave the device, and it runs through the FROZEN rig core gate:
// buildPublicPool is fail-closed (private !== false never passes; explicit
// field pick — no spread, no ride-along fields), so a private item cannot be
// published even by a UI bug upstream of this call.

import { buildPublicPool, type RigMemoryItemV1 } from "../rig/rig.ts";

export type OutboundPoolItem = {
  kind: string;
  title: string;
  text: string;
  tags: string[];
  position: number;
};

const SELF = "self";

/**
 * Project the owner's items to exactly what may be published. Returns the
 * closed set {kind,title,text,tags,position} — no private flag, no token, no
 * internal id. Order is input order (arrival order only).
 */
export function buildOutboundProjection(items: RigMemoryItemV1[]): OutboundPoolItem[] {
  const pool = buildPublicPool([{ ownerId: SELF, items }], {
    ownerRefById: new Map([[SELF, SELF]]),
  });
  return pool.map((p, i) => ({
    kind: p.kind,
    title: p.title,
    text: p.text,
    tags: [...p.tags],
    position: i,
  }));
}
