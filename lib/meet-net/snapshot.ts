// R1.5 — published-snapshot identity (pure; the storage itself lives in
// local.ts). The snapshot remembers what this device last actually pushed, so
// the UI can say honestly what is and isn't in the served pool (未反映 diff on
// the memory page, per-question state on home). One row-identity definition —
// k/t/x/g in this order — keeps every comparison and every write compatible.

import type { OutboundPoolItem } from "./projection.ts";

type SnapshotRow = { k: string; t: string; x: string; g: string[] };

function row(p: Pick<OutboundPoolItem, "kind" | "title" | "text" | "tags">): SnapshotRow {
  return { k: p.kind, t: p.title, x: p.text, g: p.tags };
}

/** The JSON to store after a successful publish. */
export function projectionSnapshotJson(items: OutboundPoolItem[]): string {
  return JSON.stringify(items.map(row));
}

/** Row identities recorded in a stored snapshot ("" / broken → empty set). */
export function snapshotRowSet(snapshot: string): Set<string> {
  try {
    const v: unknown = JSON.parse(snapshot);
    return new Set((Array.isArray(v) ? v : []).map((p) => JSON.stringify(p)));
  } catch {
    return new Set();
  }
}

/** Is this projected item among what was last pushed from this device? */
export function snapshotHas(
  snapshot: string,
  p: Pick<OutboundPoolItem, "kind" | "title" | "text" | "tags">,
): boolean {
  return snapshotRowSet(snapshot).has(JSON.stringify(row(p)));
}

/** Symmetric difference count — the 未反映 banner number. */
export function snapshotPendingCount(snapshot: string, projection: OutboundPoolItem[]): number {
  if (snapshot === "") return 0; // never published from this device — no banner
  const a = snapshotRowSet(snapshot);
  const b = new Set(projection.map((p) => JSON.stringify(row(p))));
  let n = 0;
  for (const s of a) if (!b.has(s)) n++;
  for (const s of b) if (!a.has(s)) n++;
  return n;
}
