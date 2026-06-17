// PX Device Mesh — 端末横断 merge（Phase C・verdict G3）。
// 設計: docs/r2/device-mesh-how-v0.3.md §6.2-6.4。
//
// append-only journal を recordId で dedup し、**HLC 順**（不在なら createdAt 由来の HLC 形）で並べる。
// 順序材料は timeline 収束専用 — ranking / matching / candidate quality に流入させない（§6.4・M-14）。
// 比較は使うが ranking でなく時系列収束のための整列。px-guard の dot-sort 遮断を尊重し、配列の
// `.sort` は呼ばず **手書きの安定マージ整列**で並べる＝ranking 機構と物理的に分ける。
// fold（forget wins / supersede）は既存 journal の fold が関係から計算する（到着順でない）。

import { hlcFromCreatedAt } from "./hlc.ts";

export type MergeableRecord = { recordId: string; createdAt?: string; hlc?: string };

/** recordId で dedup（同一 record は内容も同一＝冪等）。最初の出現を残す（安定）。 */
export function dedupByRecordId<T extends MergeableRecord>(records: readonly T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const r of records) {
    if (typeof r.recordId !== "string" || seen.has(r.recordId)) continue;
    seen.add(r.recordId);
    out.push(r);
  }
  return out;
}

/** 並べ替えキー: hlc（あれば）/ createdAt 由来 HLC（fallback）＋ 末尾 recordId（deterministic tie-break）。
 *  両端末で同じ record 集合なら同じキー＝同じ順＝収束する。 */
function orderKey(r: MergeableRecord): string {
  const prefix = typeof r.hlc === "string" && r.hlc !== "" ? r.hlc : hlcFromCreatedAt(r.createdAt ?? "");
  return `${prefix}|${r.recordId}`;
}

// 手書きの安定マージ整列（配列 .sort は使わない＝px-guard 準拠・timeline 専用の比較）。
function stableMergeOrder<T extends MergeableRecord>(arr: readonly T[]): T[] {
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

/** HLC 順に並べる（timeline 収束専用）。 */
export function orderByHlc<T extends MergeableRecord>(records: readonly T[]): T[] {
  return stableMergeOrder(records);
}

/** 二つの（端末由来の）record 列を union → dedup → HLC 順。決定的・収束的。 */
export function mergeRecords<T extends MergeableRecord>(a: readonly T[], b: readonly T[]): T[] {
  return orderByHlc(dedupByRecordId([...a, ...b]));
}
