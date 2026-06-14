// 記憶装置 層2(b) — 会話窓の控え＋窓 UI の pin。Run with `node --test`.
//
//   WC-1  ②opt-in 控え: save → load 往復・clear で消える（③蒸留既定へ戻る）
//   WC-2  既定は空（生 chat 揮発＝store に何も無い）
//   WC-3  PX 非送信: windowchat.ts は fetch を持たない（owner-local・端末のみ）
//   WC-4  窓 UI（MemoryWindow.tsx 構造 scan）:
//         ・no-log（submitLog/／api/／bare fetch を持たない）
//         ・③/② 永続は getWindowPersist でだけ save・OFF で clear
//         ・write 二態は runAgentTurn + confirmWrite に委譲（(a) AG-1 を UI 層でも保つ）
//         ・圧の語彙なし（既読・未読・入力中・バッジ・presence・typing）
//   WC-5  トグル既定 OFF（local.ts は "1" の時だけ ON）

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { InMemoryKeyedBackend } from "./backend.ts";
import { WindowChatStore, type WindowChatRecordV1 } from "./windowchat.ts";

const appFile = (rel: string) => new URL(`../../${rel}`, import.meta.url);
const stripAll = (s: string): string =>
  s
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\/[^\n]*/g, "");

function freshChat(): WindowChatStore {
  return new WindowChatStore(new InMemoryKeyedBackend<WindowChatRecordV1>((r) => r.entryId), {
    now: () => "2026-06-15T00:00:00.000Z",
  });
}

// ── WC-1 / WC-2: store round-trip ───────────────────────────────────────────────

test("WC-1: save → load round-trips; clear empties (③蒸留既定へ戻る)", async () => {
  const chat = freshChat();
  await chat.save([{ role: "user", text: "こんにちは" }, { role: "assistant", text: "はい" }]);
  const loaded = await chat.load();
  assert.equal(loaded.length, 2);
  await chat.clear();
  assert.deepEqual(await chat.load(), []);
});

test("WC-2: a fresh device has no transcript (生 chat 揮発の既定)", async () => {
  assert.deepEqual(await freshChat().load(), []);
});

// ── WC-3: PX 非送信 ─────────────────────────────────────────────────────────────

test("WC-3: windowchat.ts never fetches (owner-local; PX 非送信)", () => {
  const src = stripAll(readFileSync(new URL("./windowchat.ts", import.meta.url), "utf8"));
  assert.ok(!/\bfetch\s*\(/.test(src), "the transcript store must not touch the network");
});

// ── WC-4: 窓 UI 構造 ────────────────────────────────────────────────────────────

test("WC-4: MemoryWindow is no-log, persist-gated, two-state, pressure-free", () => {
  const src = stripAll(readFileSync(appFile("app/meet/MemoryWindow.tsx"), "utf8"));

  // no-log: 会話本文を PX へ出さない
  assert.ok(!src.includes("submitLog"), "window must not touch the test-disclosure lane");
  assert.ok(!src.includes("/api/"), "window names no /api endpoint (message body never goes to PX)");
  assert.ok(!/\bfetch\s*\(/.test(src), "window holds no fetch (provider via generateTurn; port via portCall)");

  // ②opt-in: 控えは getWindowPersist の時だけ・OFF で clear
  assert.ok(src.includes("getWindowPersist"), "persistence is gated on the toggle");
  assert.ok(/getWindowPersist\(\)\)?\s*\)?\s*(await\s+)?chat\.save|getWindowPersist\(\)/.test(src));
  assert.ok(src.includes("chat.save") && src.includes("chat.clear"), "ON saves; OFF clears");

  // write 二態: ループは (a) に委譲し confirmWrite を渡す（UI が直に write を撃たない）
  assert.ok(src.includes("runAgentTurn"), "the loop is the audited agent loop");
  assert.ok(src.includes("confirmWrite"), "writes go through the owner confirm card");

  // 圧の語彙なし
  for (const p of ["既読", "未読", "入力中", "バッジ", "presence", "typing"]) {
    assert.ok(!src.includes(p), `window must not carry pressure vocab: ${p}`);
  }
});

test("WC-4b: MemoryWindow renders the gated 命名 (window/蒸留/toggle) from copy", () => {
  const src = readFileSync(appFile("app/meet/MemoryWindow.tsx"), "utf8");
  // the window draws its naming from the gated copy block, not inline literals
  assert.ok(src.includes("MEET.home.aiWindow") || /\bC\.(title|distillAsk|persistToggle)/.test(src));
});

// ── WC-5: トグル既定 OFF ─────────────────────────────────────────────────────────

test("WC-5: the persist toggle defaults OFF (③蒸留 is the default)", () => {
  const src = readFileSync(appFile("lib/meet-net/local.ts"), "utf8");
  // getWindowPersist returns true ONLY for the explicit "1" — absent ⇒ OFF
  assert.ok(/getWindowPersist[\s\S]{0,160}===\s*"1"/.test(src), "default OFF (fail-closed to 揮発)");
});
