// 記憶装置 層1b — reading の pin。Run with `node --test`.
//
//   RD-1  journal 非汚染: reading.ts は journal に append 以外の書き込みをしない
//         （write 経路を import も呼び出しもしない・複利しない）
//   RD-2  forgotten 既定除外: forget で指された記憶は既定 reading に出ない／
//         「全部見せて」(showAll) で復帰する
//   RD-3  タグトリガーの深度: body.tags 経由で recency 窓の外・表層外にも到達する
//         （問いにタグが現れた時だけ）
//   RD-4  superseded 除外: supersedes 連鎖の古い body は既定 reading に出ない（最新優先）
//   RD-5  ビューキャッシュは捨てられる: clear で空・selection は PURE で再構築できる
//   RD-6  parse fail-closed: 壊れた返答は空の読み（throw しない）／解決できない参照は
//         落とす（AI の発明が混ざらない）

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { InMemoryKeyedBackend } from "../meet-memory/backend.ts";
import { MemJournalStore } from "../meet-memory/journal.ts";
import type { MemJournalRecordV1, NewContentRecordV1 } from "../meet-memory/journal-types.ts";
import {
  selectForReading,
  composeReadingPrompt,
  parseReadingReply,
  resolveReading,
  ReadingViewCache,
} from "./reading.ts";

function freshJournal(): MemJournalStore {
  let n = 0;
  return new MemJournalStore(new InMemoryKeyedBackend<MemJournalRecordV1>((r) => r.recordId), {
    now: () => "2026-06-15T00:00:00.000Z",
    genId: () => `mem-${++n}`,
  });
}

const content = (text: string, tags: string[] = []): NewContentRecordV1 => ({
  contentKind: "rig_item",
  provenance: "owner_written",
  sourceRef: { channel: "note" },
  body: { kind: "memory", title: "", text, tags, private: true },
});

// ── RD-1: journal 非汚染（構造）────────────────────────────────────────────────

test("RD-1: reading.ts never writes to the journal (no write path, no store import)", () => {
  const src = readFileSync(new URL("./reading.ts", import.meta.url), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");
  for (const bad of [".append(", ".appendEvent(", ".supersede(", ".restore(", ".put(", ".remove("]) {
    assert.ok(!src.includes(bad), `reading.ts must not call ${bad} (journal は append 以外しない)`);
  }
  assert.ok(!src.includes("MemJournalStore"), "reading must not hold the journal STORE (read-only helpers only)");
  assert.ok(!src.includes("MeetMemoryStore"), "reading must not touch the substrate store");
});

// ── RD-2: forgotten 既定除外／全部見せてで復帰 ─────────────────────────────────

test("RD-2: forgotten content is hidden by default and returns under showAll", async () => {
  const j = freshJournal();
  const keep = await j.append(content("活版印刷ができる"));
  const drop = await j.append(content("もう閉じた店のこと"));
  await j.appendEvent({ eventKind: "forget", provenance: "owner_written", sourceRef: { channel: "note" }, targetRef: drop.recordId });
  const all = await j.list();

  const def = selectForReading(all, "");
  const defIds = def.records.map((r) => r.recordId);
  assert.ok(defIds.includes(keep.recordId), "live memory stays");
  assert.ok(!defIds.includes(drop.recordId), "forgotten memory leaves the default view");
  assert.equal(def.forgottenHidden, 1, "honestly reports what it hid");

  const all2 = selectForReading(all, "", { showAll: true });
  assert.ok(all2.records.map((r) => r.recordId).includes(drop.recordId), "全部見せて で復帰");
  assert.equal(all2.forgottenHidden, 0);
});

// ── RD-3: タグトリガーの深度 ─────────────────────────────────────────────────

test("RD-3: a tag in the question reaches a record outside the recency window", async () => {
  const j = freshJournal();
  const tagged = await j.append(content("フレンチの修業時代", ["フレンチ"])); // seq 0 — 一番古い
  await j.append(content("最近の現場 1"));
  await j.append(content("最近の現場 2")); // seq 2 — 最新

  const all = await j.list();
  // window=1 ⇒ 深層は最新1件だけ。タグ無しの問いでは古い tagged は出ない。
  const plain = selectForReading(all, "今日はどう", { window: 1 });
  assert.ok(!plain.records.map((r) => r.recordId).includes(tagged.recordId), "窓の外の古い記憶は深層に出ない");

  // 問いにタグ語が出たら、窓の外でも掘り当てる。
  const dug = selectForReading(all, "フレンチの頃のこと", { window: 1 });
  assert.deepEqual(dug.triggeredTags, ["フレンチ"]);
  assert.ok(dug.records.map((r) => r.recordId).includes(tagged.recordId), "タグが呼べば窓の外へ潜る");
});

// ── RD-4: superseded 除外（最新優先）─────────────────────────────────────────

test("RD-4: a superseded old body never appears; the head body does", async () => {
  const j = freshJournal();
  const first = await j.append(content("初稿の本文"));
  await j.supersede(first.recordId, content("訂正後の本文"));
  const all = await j.list();
  const sel = selectForReading(all, "");
  const texts = sel.records.map((r) => (r.recordType === "content" ? r.body.text : ""));
  assert.ok(texts.includes("訂正後の本文"), "the head body is read");
  assert.ok(!texts.includes("初稿の本文"), "the superseded old body is not read");
  assert.equal(sel.records.length, 1);
});

// ── RD-5: ビューキャッシュは捨てられる・selection は決定的 ─────────────────────

test("RD-5: the view cache is discardable and the selection is deterministic", async () => {
  const j = freshJournal();
  await j.append(content("一", ["旅"]));
  await j.append(content("二"));
  const all = await j.list();

  // 決定的: 同じ (journal, 問い) → 同じ selection（キャッシュを消しても再構築できる根拠）。
  const a = selectForReading(all, "旅のこと");
  const b = selectForReading(all, "旅のこと");
  assert.deepEqual(a.records.map((r) => r.recordId), b.records.map((r) => r.recordId));

  const cache = new ReadingViewCache();
  const { refs } = composeReadingPrompt(all, "旅のこと");
  cache.put(resolveReading({ found: Object.keys(refs).slice(0, 1), note: "見つかった" }, refs, "raw", "旅のこと", "t"));
  assert.equal(cache.list().length, 1);
  cache.clear();
  assert.equal(cache.list().length, 0, "切り直す = ビューを捨てる（journal は無傷）");
});

// ── RD-6: parse は fail-closed・発明は解決で落ちる ───────────────────────────

test("RD-6: reply parsing never throws; junk becomes an empty reading", () => {
  for (const junk of ["", "{broken", "今日はどうでしょう", "[]", "42", '{"found":"x"}']) {
    const r = parseReadingReply(junk);
    assert.deepEqual(r.found, [], `junk → no found: ${junk}`);
    assert.equal(r.note, "");
  }
  // fenced / prose-wrapped valid replies parse
  const ok = parseReadingReply('```json\n{"found":["m1","m3"],"note":" 旅の記憶 "}\n```');
  assert.deepEqual(ok.found, ["m1", "m3"]);
  assert.equal(ok.note, "旅の記憶");
});

test("RD-6b: resolveReading drops refs that don't resolve (no invented memory)", () => {
  const refs = { m1: "rec-1", m2: "rec-2" };
  const out = resolveReading({ found: ["m1", "m9", "m2", "m1"], note: "n" }, refs, "raw", "q", "t");
  assert.deepEqual(out.foundRecordIds, ["rec-1", "rec-2"], "unknown m9 dropped; dup m1 collapsed");
  assert.equal(out.note, "n");
  assert.equal(out.raw, "raw");
});
