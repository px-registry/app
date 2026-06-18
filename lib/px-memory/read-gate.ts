// PX Memory v0.1 — Read Gate と Run packet.
//
// Read Gate は「この item を AI に見せてよいか／raw を見せてよいか」を決める唯一の関門。
// 深層から拾った item も必ずここを通す（Hard STOP: AI に渡す前に Read Gate）。
// fail-closed: 忘れた／hidden は見せない。
//
// 通常 Run は表層だけを読む（要件5）。深層は triggerText から cue が当たった時だけ
// 検索対象にし（要件6）、当たっても Read Gate を通してから渡す（要件7）。

import type { MemoryItem, ReadGateDecision, RunMemoryPacket } from "./types.ts";

/**
 * Read Gate。すべての「AI に渡す」経路の関門。
 *  - 忘れた（forgotten）/ hidden → allow=false（raw も伏せる）
 *  - それ以外 → allow=true・raw OK
 */
export function applyReadGate(item: MemoryItem): ReadGateDecision {
  if (item.forgotten || item.placement === "hidden") {
    return { allow: false, redactRaw: true, reason: "forgotten" };
  }
  return { allow: true, redactRaw: false, reason: item.placement };
}

/** cue が triggerText に現れるか（部分一致・日本語の分かち書き不要）。空 cue は当たらない。 */
function cuesPresentIn(cues: string[], triggerText: string): string[] {
  const hits: string[] = [];
  for (const c of cues) {
    if (c.length > 0 && triggerText.includes(c)) hits.push(c);
  }
  return hits;
}

/**
 * 通常 Run の記憶束を組む。
 *  - surface: 表層 item を Read Gate 通過分だけ（常に通常 Run に入る）。
 *  - dug: triggerText がある時だけ、deep item の cue が当たったものを Read Gate に通す。
 *  - triggerCues: 実際に当たった cue の集合（素の Run では空）。
 * placement の判別はここで（surface か deep か）。「AI に見せてよいか」は Read Gate。
 */
export function buildRunMemoryPacket(
  items: MemoryItem[],
  opts?: { triggerText?: string },
): RunMemoryPacket {
  const triggerText = opts?.triggerText ?? "";

  const surface: MemoryItem[] = [];
  for (const item of items) {
    if (item.placement === "surface" && applyReadGate(item).allow) surface.push(item);
  }

  const dug: MemoryItem[] = [];
  const cueHits = new Set<string>();
  if (triggerText.length > 0) {
    for (const item of items) {
      if (item.placement !== "deep") continue; // 深層だけが cue 検索の対象（要件6）
      const hits = cuesPresentIn(item.body.cues, triggerText);
      if (hits.length === 0) continue;
      if (!applyReadGate(item).allow) continue; // 拾っても Read Gate を通す（要件7）
      for (const h of hits) cueHits.add(h);
      dug.push(item);
    }
  }

  return { surface, dug, triggerCues: [...cueHits] };
}
