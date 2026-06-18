// PX Memory v0.1 — pin tests. Run with `node --test`.
//
//   PM-1  未選択の記憶は既定で deep（createMemoryItemFromEvent / fold）
//   PM-2  未選択は端末に保持されるが通常 Run packet に入らない
//   PM-3  「残す」(surface) だけが通常 Run packet に入る
//   PM-4  「外す」は通常 Run packet から外す（raw event は消えない）
//   PM-5  deep は trigger cue が当たらない限り除外（要件3/6）
//   PM-6  deep は cue + Read Gate を通った時だけ拾われる（要件7・12）
//   PM-7  projection は sourceEventIds 無しでは作れない（throw）
//   PM-8  「+Antenna」は AntennaContextCard draft を作る／raw を載せない（要件8）
//   PM-9  hidden / tombstoned は Read Gate が除外（要件6）
//   PM-10 Owner-facing copy は禁止語を含まない
//   PM-11 store 一周（capture→残す→外す→+Antenna→forget）の append-only 性

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  createMemoryEvent,
  createMemoryItemFromEvent,
  moveMemoryToSurface,
  removeMemoryFromRun,
  forgetMemory,
  foldMemoryItems,
  nextSeq,
} from "./memory.ts";
import { createMemoryProjection } from "./projection.ts";
import { applyReadGate, buildRunMemoryPacket } from "./read-gate.ts";
import { createAntennaContextDraft } from "./antenna.ts";
import { PxMemoryStore } from "./store.ts";
import { PX_MEMORY_COPY, PX_MEMORY_FORBIDDEN_OWNER_WORDS } from "./copy.ts";
import type { EventCtx } from "./memory.ts";
import type { MemoryEvent, MemoryItem } from "./types.ts";

let seqCounter = 0;
let idCounter = 0;
function freshCtx(): EventCtx {
  return { eventId: `ev-${++idCounter}`, seq: seqCounter++, now: "2026-06-18T00:00:00.000Z" };
}
function captureItem(text: string, cues: string[]): { event: MemoryEvent; item: MemoryItem } {
  const event = createMemoryEvent({ body: { text, cues } }, freshCtx());
  return { event, item: createMemoryItemFromEvent(event) };
}

// ── PM-1: 未選択は既定 deep ───────────────────────────────────────────────────────
test("PM-1: unselected memory defaults to deep", () => {
  const { item } = captureItem("ある記憶", ["木工"]);
  assert.equal(item.placement, "deep");
  assert.equal(item.forgotten, false);
});

// ── PM-2: 未選択は保持されるが通常 Run に入らない ─────────────────────────────────
test("PM-2: unselected memory is retained internally but excluded from normal Run packet", () => {
  const { item } = captureItem("ある記憶", ["木工"]);
  const packet = buildRunMemoryPacket([item]); // trigger なし = 素の Run
  assert.equal(packet.surface.length, 0);
  assert.equal(packet.dug.length, 0);
});

// ── PM-3: 「残す」だけが通常 Run に入る ───────────────────────────────────────────
test("PM-3: only 残す (surface) memory is included in normal Run packet", () => {
  const a = captureItem("残す方", ["a"]);
  const b = captureItem("残さない方", ["b"]);
  const kept = moveMemoryToSurface(a.item, freshCtx()).item;
  const packet = buildRunMemoryPacket([kept, b.item]);
  assert.equal(packet.surface.length, 1);
  assert.equal(packet.surface[0].itemId, kept.itemId);
});

// ── PM-4: 「外す」は通常 Run から外す（raw event は消えない）──────────────────────
test("PM-4: 外す excludes memory from normal Run packet (raw event kept)", () => {
  const a = captureItem("once kept", ["a"]);
  const kept = moveMemoryToSurface(a.item, freshCtx());
  const removed = removeMemoryFromRun(kept.item, freshCtx());
  assert.equal(removed.item.placement, "deep");
  assert.equal(buildRunMemoryPacket([removed.item]).surface.length, 0);
  // raw event は消えない — fold が capture を保持する
  const events = [a.event, kept.event, removed.event];
  const folded = foldMemoryItems(events);
  assert.equal(folded.length, 1);
  assert.equal(folded[0].body.text, "once kept");
  assert.ok(folded[0].sourceEventIds.length >= 3);
});

// ── PM-5: deep は cue が当たらない限り除外 ────────────────────────────────────────
test("PM-5: deep memory is excluded unless trigger cues match", () => {
  const { item } = captureItem("木工の道具を探している", ["木工", "鉋"]);
  // trigger 無し
  assert.equal(buildRunMemoryPacket([item]).dug.length, 0);
  // 関係ない trigger
  assert.equal(buildRunMemoryPacket([item], { triggerText: "料理の話" }).dug.length, 0);
});

// ── PM-6: deep は cue + Read Gate を通った時だけ拾う ──────────────────────────────
test("PM-6: deep memory is retrieved only through trigger cue + Read Gate", () => {
  const { item } = captureItem("木工の道具を探している", ["木工", "鉋"]);
  const packet = buildRunMemoryPacket([item], { triggerText: "今日は木工の話をしたい" });
  assert.equal(packet.dug.length, 1);
  assert.equal(packet.dug[0].itemId, item.itemId);
  assert.deepEqual(packet.triggerCues, ["木工"]);
});

// ── PM-7: projection は sourceEventIds 無しで作れない ─────────────────────────────
test("PM-7: projection cannot exist without sourceEventIds", () => {
  assert.throws(
    () => createMemoryProjection({ kind: "summary", sourceEventIds: [], value: "x" }, {
      projectionId: "p1",
      now: "2026-06-18T00:00:00.000Z",
    }),
    /sourceEventIds/,
  );
  const ok = createMemoryProjection(
    { kind: "summary", sourceEventIds: ["ev-1"], value: "要約" },
    { projectionId: "p1", now: "2026-06-18T00:00:00.000Z" },
  );
  assert.deepEqual(ok.sourceEventIds, ["ev-1"]);
});

// ── PM-8: 「+Antenna」は draft を作り raw を載せない ──────────────────────────────
test("PM-8: +Antenna creates an AntennaContextCard draft without raw private text", () => {
  const { item } = captureItem("これは秘密の生テキスト", ["木工"]);
  const card = createAntennaContextDraft(item, { cardId: "ant-1", now: "2026-06-18T00:00:00.000Z" });
  assert.equal(card.status, "draft");
  assert.equal(card.includesRawText, false);
  assert.equal(card.summary, ""); // 既定は空 — raw で自動補完しない
  assert.equal(card.cues.length, 0); // raw cues を黙って公開しない
  assert.equal(card.sourceItemId, item.itemId);
  assert.ok(card.sourceEventIds.length >= 1);
  // どのフィールドにも raw private text が漏れていない
  assert.ok(!JSON.stringify(card).includes("これは秘密の生テキスト"));
});

// ── PM-9: hidden / tombstoned は Read Gate が除外 ─────────────────────────────────
test("PM-9: hidden/tombstoned memory is excluded by Read Gate", () => {
  const a = captureItem("忘れる記憶", ["木工"]);
  const kept = moveMemoryToSurface(a.item, freshCtx());
  const gone = forgetMemory(kept.item, freshCtx());
  assert.equal(gone.item.placement, "hidden");
  assert.equal(gone.item.forgotten, true);
  // Read Gate 単体
  const decision = applyReadGate(gone.item);
  assert.equal(decision.allow, false);
  assert.equal(decision.redactRaw, true);
  // packet: surface にも dug にも出ない（cue が当たっても）
  const packet = buildRunMemoryPacket([gone.item], { triggerText: "木工の話" });
  assert.equal(packet.surface.length, 0);
  assert.equal(packet.dug.length, 0);
});

// ── PM-10: Owner-facing copy は禁止語を含まない ──────────────────────────────────
test("PM-10: Owner-facing UI strings exclude forbidden vocabulary", () => {
  const strings = Object.values(PX_MEMORY_COPY);
  for (const s of strings) {
    for (const banned of PX_MEMORY_FORBIDDEN_OWNER_WORDS) {
      assert.ok(!s.includes(banned), `owner copy "${s}" must not include "${banned}"`);
    }
  }
});

// ── PM-11: store 一周（append-only・本物の wiring）──────────────────────────────
test("PM-11: store round-trip stays append-only across 残す/外す/+Antenna/forget", async () => {
  let n = 0;
  let p = 0;
  const store = new PxMemoryStore({
    now: () => "2026-06-18T00:00:00.000Z",
    genId: (prefix) => `${prefix}-${++p}`,
  });
  void n;

  const item = await store.capture({ text: "raw 本文", cues: ["木工"] });
  assert.equal(item.placement, "deep");
  assert.equal((await store.runPacket()).surface.length, 0);

  await store.keepInRun(item.itemId);
  assert.equal((await store.runPacket()).surface.length, 1);

  await store.removeFromRun(item.itemId);
  assert.equal((await store.runPacket()).surface.length, 0);

  // deep に戻っても cue で拾える
  const dug = await store.runPacket("木工の相談");
  assert.equal(dug.dug.length, 1);

  const card = await store.draftAntenna(item.itemId);
  assert.equal(card.includesRawText, false);
  assert.equal((await store.listAntennaDrafts()).length, 1);

  await store.forget(item.itemId);
  const after = await store.runPacket("木工の相談");
  assert.equal(after.surface.length, 0);
  assert.equal(after.dug.length, 0);

  // append-only: capture(1) + place surface(1) + place deep(1) + forget(1) = 4 events
  const events = await store.listEvents();
  assert.equal(events.length, 4);
  // seq は穴なし単調増加
  assert.deepEqual(events.map((e) => e.seq), [0, 1, 2, 3]);
  // nextSeq は次の長さ
  assert.equal(nextSeq(events), 4);
});
