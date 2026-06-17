// PX Device Mesh — Talk dual-read timeline（Phase C.1・verdict G3）。
// 設計: docs/r2/device-mesh-how-v0.3.md §15.3-15.4・§6.4。
//
// legacy（r15_envelope 復号）と mesh（talk-msg/talk-mirror 復号）の Talk entry は **同じ talk store**
// に入る。この関数はそれを **一本の timeline** に整える:
//   - entryId で dedup（二重表示しない・受信は env id で冪等＝legacy/mesh が同じ message なら 1 つ）
//   - **edge_note / standing note（kind="note-out"）は timeline に混ぜない**（§15・edge 面の一枚）
//   - (at, entryId) の決定的キーで並べる → 端末 A/B が同じ入力なら同じ順（収束）
// 順序材料（at/entryId）は timeline 収束専用 — ranking/matching/candidate quality に流入させない（§6.4）。
// 比較は使うが配列 .sort は呼ばず手書き安定マージ（px-guard 準拠・ranking 機構と分ける）。

export type TalkLike = { entryId: string; edgeId: string; kind: string; at: string };

/** timeline に出さない kind（edge_note / standing note）。 */
const NON_TIMELINE_KINDS = new Set(["note-out"]);

function orderKey(e: TalkLike): string {
  return `${e.at}|${e.entryId}`;
}

function stableMergeOrder<T extends TalkLike>(arr: readonly T[]): T[] {
  if (arr.length <= 1) return [...arr];
  const mid = arr.length >> 1;
  const left = stableMergeOrder(arr.slice(0, mid));
  const right = stableMergeOrder(arr.slice(mid));
  const out: T[] = [];
  let i = 0;
  let j = 0;
  while (i < left.length && j < right.length) {
    if (orderKey(left[i]) <= orderKey(right[j])) out.push(left[i++]);
    else out.push(right[j++]);
  }
  while (i < left.length) out.push(left[i++]);
  while (j < right.length) out.push(right[j++]);
  return out;
}

/**
 * legacy ＋ mesh の Talk entry を一本の timeline に: entryId dedup → note-out 除外 → (at,entryId) 決定的順。
 * 入力順に依らず同じ出力（端末 A/B で収束）。
 */
export function mergeTalkTimeline<T extends TalkLike>(...lanes: readonly T[][]): T[] {
  const seen = new Set<string>();
  const kept: T[] = [];
  for (const lane of lanes) {
    for (const e of lane) {
      if (typeof e.entryId !== "string" || seen.has(e.entryId)) continue;
      if (NON_TIMELINE_KINDS.has(e.kind)) continue; // edge_note は timeline 対象外
      seen.add(e.entryId);
      kept.push(e);
    }
  }
  return stableMergeOrder(kept);
}

/** 一本の thread（同一 edgeId）に絞った timeline。 */
export function threadTimeline<T extends TalkLike>(edgeId: string, ...lanes: readonly T[][]): T[] {
  const filtered = lanes.map((lane) => lane.filter((e) => e.edgeId === edgeId));
  return mergeTalkTimeline(...filtered);
}
