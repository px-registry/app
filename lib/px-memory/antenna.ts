// PX Memory v0.1 — 「+Antenna」.
//
// 「+Antenna」は **Raw Memory 公開ではない**（要件8）: AntennaContextCard の *draft* を
// 作るだけ。draft は raw private text を載せない（includesRawText: false の hard invariant）。
// summary は既定で空 — Owner が書き、公開（antenna_public）は Owner 承認の別経路。
// AI が自動で Antenna 公開しない（Hard STOP）。

import type { AntennaContextCard, MemoryItem } from "./types.ts";

export type AntennaCtx = { cardId: string; now: string };

/**
 * MemoryItem から AntennaContextCard の draft を作る。
 * 既定では raw private text を一切出さない（summary は空）。cue は Owner が選んだ
 * 公開 cue を任意で渡せる（既定は無し）— item の raw cues を黙って公開はしない。
 */
export function createAntennaContextDraft(
  item: MemoryItem,
  ctx: AntennaCtx,
  opts?: { summary?: string; cues?: string[] },
): AntennaContextCard {
  const [first, ...rest] = item.sourceEventIds;
  return {
    cardId: ctx.cardId,
    sourceItemId: item.itemId,
    sourceEventIds: [first, ...rest],
    summary: opts?.summary ?? "",
    cues: opts?.cues ?? [],
    includesRawText: false,
    status: "draft",
    createdAt: ctx.now,
  };
}
