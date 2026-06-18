// PX Memory v0.1 — pure functions over the append-only Raw Memory length.
//
// すべて PURE: 副作用なし・I/O なし・ネットワークなし。id / seq / now は呼び手が
// 注入する（ctx）。store.ts がそれを巻き取る。順序は比較ソートを使わず seq の位置で
// 並べる（px-guard の dot-sort 禁止＝順位付け忍び込み防止に正面から沿う）。
//
// 「外す」= removeMemoryFromRun = stowMemoryDeep（deep へ戻す・物理削除しない）。
// 「残す」= moveMemoryToSurface。どちらも append（place event）で表現する。

import type {
  MemoryEvent,
  MemoryItem,
  MemoryProvenance,
  MemoryReadPlacement,
  RawMemoryBody,
} from "./types.ts";
import { DEFAULT_PLACEMENT } from "./types.ts";

/** event 一つを生むときに呼び手が注入する材料。 */
export type EventCtx = { eventId: string; seq: number; now: string };

/** 既存 events の次の seq（最大 + 1・空なら 0）。append-only ⇒ 穴なし。 */
export function nextSeq(events: MemoryEvent[]): number {
  let max = -1;
  for (const e of events) if (e.seq > max) max = e.seq;
  return max + 1;
}

/**
 * seq 昇順に並べる。比較ソートではなく seq を配列の添字に置くだけ（穴があれば落とす）。
 * 同 seq は不変上起きないが、起きても last-wins で落ちない。
 */
export function orderBySeq(events: MemoryEvent[]): MemoryEvent[] {
  let max = -1;
  for (const e of events) if (e.seq > max) max = e.seq;
  const slots: (MemoryEvent | undefined)[] = new Array(max + 1);
  for (const e of events) slots[e.seq] = e;
  return slots.filter((e): e is MemoryEvent => e !== undefined);
}

/** Raw Memory が生まれる — capture event を作る（中身を持つ唯一の入口）。 */
export function createMemoryEvent(
  input: { body: RawMemoryBody; provenance?: MemoryProvenance },
  ctx: EventCtx,
): MemoryEvent {
  return {
    eventId: ctx.eventId,
    seq: ctx.seq,
    createdAt: ctx.now,
    provenance: input.provenance ?? "owner",
    type: "capture",
    body: input.body,
  };
}

/**
 * capture event から MemoryItem の初期ビューを作る。**未選択の既定は deep**
 * — 選ばれなかった記憶は端末に保持されるが通常 Run では読まれない。
 */
export function createMemoryItemFromEvent(capture: MemoryEvent): MemoryItem {
  if (capture.type !== "capture") {
    throw new Error("createMemoryItemFromEvent expects a capture event");
  }
  return {
    itemId: capture.eventId,
    sourceEventIds: [capture.eventId],
    body: capture.body,
    placement: DEFAULT_PLACEMENT,
    forgotten: false,
    createdAt: capture.createdAt,
    updatedAt: capture.createdAt,
  };
}

/** place event（placement 変更）を作る PURE ヘルパ。 */
function makePlaceEvent(
  item: MemoryItem,
  placement: MemoryReadPlacement,
  ctx: EventCtx,
): MemoryEvent {
  return {
    eventId: ctx.eventId,
    seq: ctx.seq,
    createdAt: ctx.now,
    provenance: "owner",
    type: "place",
    targetEventId: item.itemId,
    placement,
  };
}

/** place event を畳んで item の新ビューを返す（append-only — item は作り直す）。 */
function applyPlaceToItem(
  item: MemoryItem,
  event: MemoryEvent,
  placement: MemoryReadPlacement,
  forgotten: boolean,
): MemoryItem {
  return {
    ...item,
    placement,
    forgotten,
    sourceEventIds: [...item.sourceEventIds, event.eventId],
    updatedAt: event.createdAt,
  };
}

export type MemoryMutation = { event: MemoryEvent; item: MemoryItem };

/** 「残す」— surface へ上げる。通常 Run で読まれるようになる。 */
export function moveMemoryToSurface(item: MemoryItem, ctx: EventCtx): MemoryMutation {
  const event = makePlaceEvent(item, "surface", ctx);
  return { event, item: applyPlaceToItem(item, event, "surface", false) };
}

/**
 * 内部: deep へしまう（既定の置き場所へ戻す）。**Owner-facing UI には「深くしまう」を
 * 出さない** — これは「外す」（通常 Run から外す）の実体。物理削除しない。
 */
export function stowMemoryDeep(item: MemoryItem, ctx: EventCtx): MemoryMutation {
  const event = makePlaceEvent(item, "deep", ctx);
  return { event, item: applyPlaceToItem(item, event, "deep", false) };
}

/** 「外す」= 通常 Run から外す。raw event は消さず deep へ戻すだけ（stowMemoryDeep の別名）。 */
export const removeMemoryFromRun = stowMemoryDeep;

/**
 * 忘れる — forget event（tombstone）を append。物理削除しない（長さは保つ）。
 * placement は hidden になり Read Gate が完全に除外する。Owner 承認操作（自動化しない）。
 * ※ これは「外す」とは別 — 3 つの Owner-facing 操作（残す/外す/+Antenna）には含めない。
 */
export function forgetMemory(item: MemoryItem, ctx: EventCtx): MemoryMutation {
  const event: MemoryEvent = {
    eventId: ctx.eventId,
    seq: ctx.seq,
    createdAt: ctx.now,
    provenance: "owner",
    type: "forget",
    targetEventId: item.itemId,
  };
  return { event, item: applyPlaceToItem(item, event, "hidden", true) };
}

/**
 * events 全体を畳んで現在の MemoryItem 群を作る（最新優先・seq 位置順）。
 * capture ごとに、後続の place / forget の最新を重ねる。
 */
export function foldMemoryItems(events: MemoryEvent[]): MemoryItem[] {
  const ordered = orderBySeq(events);
  const byId = new Map<string, MemoryItem>();
  for (const e of ordered) {
    if (e.type === "capture") {
      byId.set(e.eventId, createMemoryItemFromEvent(e));
    } else {
      const target = byId.get(e.targetEventId);
      if (!target) continue; // 出自不明の指しは黙って落とす（fail-closed）
      if (e.type === "place") {
        byId.set(
          e.targetEventId,
          applyPlaceToItem(target, e, e.placement, e.placement === "hidden"),
        );
      } else {
        byId.set(e.targetEventId, applyPlaceToItem(target, e, "hidden", true));
      }
    }
  }
  // capture の seq 位置で並べる（比較ソート禁止）。
  const captureOrder = ordered.filter((e) => e.type === "capture").map((e) => e.eventId);
  return captureOrder.map((id) => byId.get(id)).filter((i): i is MemoryItem => i !== undefined);
}
