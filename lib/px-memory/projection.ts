// PX Memory v0.1 — projections.
//
// projection = 蒸留 / 要約 / claim / embedding / relation。**source of truth ではない**:
// 必ず sourceEventIds（非空）を持ち、いつでも Raw Memory（events）へ戻れる派生でしかない。
// summary/distillation を真理にしない（Hard STOP）。

import type { MemoryProjection, MemoryProjectionKind } from "./types.ts";

export type ProjectionCtx = { projectionId: string; now: string };

/**
 * projection を作る。**sourceEventIds が空なら throw**（projection は出自なしには
 * 存在できない — Raw Memory の置き換えを型でも実装でも塞ぐ）。
 */
export function createMemoryProjection(
  input: { kind: MemoryProjectionKind; sourceEventIds: string[]; value: unknown },
  ctx: ProjectionCtx,
): MemoryProjection {
  if (!input.sourceEventIds || input.sourceEventIds.length === 0) {
    throw new Error("MemoryProjection requires non-empty sourceEventIds (no source of truth replacement)");
  }
  const [first, ...rest] = input.sourceEventIds;
  return {
    projectionId: ctx.projectionId,
    kind: input.kind,
    sourceEventIds: [first, ...rest],
    value: input.value,
    createdAt: ctx.now,
  };
}
