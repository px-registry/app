// R1.5 meet memory gates + substrate proofs. Run with `node --test`.
//
// Stage B lineage (lib/owner-memory/b-gates.test.ts), applied to the R1.5
// substrate. STOP #2 decision pinned here: hybrid = durable owner-local store
// (IndexedDB) + export/import backup, server memory-blind.
//
//   MM-1  no network symbol anywhere in lib/meet-memory
//   MM-2  indexedDB appears ONLY in the dedicated backend file
//   MM-3  server memory-blind — no Function imports this module or its types;
//         no migration defines a meet/r15 memory table
//   MM-4  forbidden copy — module sources (incl. the cold-start prompt) clean
//   MM-5  provenance required; an AI-authored entry is refused at the validator
//   MM-6  rig_item.private must be an explicit boolean (no default-to-public)
//   MM-7  read / edit / export / IMPORT / delete lifecycle (backend-agnostic)
//   MM-8  import is fail-closed: wrong format / garbage / broken entries
//   MM-9  cold-start intake: lenient extraction, fail-closed items,
//         private defaults to TRUE, never throws

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

import { InMemoryMeetBackend, InMemoryKeyedBackend } from "./backend.ts";
import { FirstNoteStore, firstNoteKey, type FirstNoteDraftV1 } from "./firstnote.ts";
import { MeetMemoryStore, MEET_EXPORT_FORMAT, MEET_EXPORT_FORMAT_V2 } from "./store.ts";
import { validateNewEntry } from "./validate.ts";
import { parseColdStartPaste } from "./intake.ts";
import {
  PLACED_QUESTION_TAG,
  draftPlacedQuestion,
  draftPlacedQuestionTitle,
  isPlacedQuestion,
} from "./placed.ts";
import { toPublicView, hasPublicVariant } from "./public-view.ts";
import {
  parseMaskWords,
  findMaskLeaks,
  filterDetections,
  applyMasks,
  mergeMaskWords,
} from "./mask-check.ts";
import { findForbiddenTerm } from "../meet/forbidden.ts";

const root = (rel: string) => new URL(`../../${rel}`, import.meta.url);
const read = (rel: string) => readFileSync(root(rel), "utf8");

/** Comments stripped — the scans read code + string literals, not prose. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

function moduleSources(): Array<{ name: string; code: string }> {
  const out: Array<{ name: string; code: string }> = [];
  for (const ent of readdirSync(root("lib/meet-memory"), { withFileTypes: true })) {
    if (ent.name.endsWith(".ts") && !ent.name.endsWith(".test.ts")) {
      out.push({ name: ent.name, code: stripComments(read(`lib/meet-memory/${ent.name}`)) });
    }
  }
  return out;
}

function allFunctionSources(): string[] {
  const out: string[] = [];
  const walk = (relDir: string): void => {
    for (const ent of readdirSync(root(relDir), { withFileTypes: true })) {
      const rel = `${relDir}/${ent.name}`;
      if (ent.isDirectory()) walk(rel);
      else if (ent.name.endsWith(".ts") && !ent.name.endsWith(".test.ts")) out.push(read(rel));
    }
  };
  walk("functions");
  return out;
}

// ── MM-1 / MM-2: structural no-io ───────────────────────────────────────────────

test("MM-1: lib/meet-memory never talks to a network", () => {
  for (const { name, code } of moduleSources()) {
    for (const re of [/\bfetch\s*\(/, /XMLHttpRequest/, /\bWebSocket\b/]) {
      assert.ok(!re.test(code), `lib/meet-memory/${name} must not contain ${re}`);
    }
  }
});

test("MM-2: indexedDB lives only in indexeddb.ts (the audited backend)", () => {
  for (const { name, code } of moduleSources()) {
    if (name === "indexeddb.ts") continue;
    // The GLOBAL is what must not leak (importing the audited backend is fine).
    assert.ok(!/\bindexedDB\s*[.(]/.test(code), `lib/meet-memory/${name} must not touch indexedDB`);
    assert.ok(!/localStorage/.test(code), `lib/meet-memory/${name} must not touch localStorage`);
  }
});

// ── MM-3: server memory-blind ───────────────────────────────────────────────────

test("MM-3: no Function imports meet-memory; no migration defines its table", () => {
  for (const src of allFunctionSources()) {
    assert.ok(!/meet-memory/.test(src), "a Function imports meet-memory");
    assert.ok(!/MeetMemoryEntryV1/.test(src), "a Function references the entry type");
  }
  for (const ent of readdirSync(root("migrations"))) {
    const sql = read(`migrations/${ent}`).toLowerCase();
    assert.ok(!sql.includes("meet_memory"), `${ent} must not define meet_memory`);
    assert.ok(!sql.includes("r15_memory"), `${ent} must not define r15_memory`);
  }
});

// ── MM-3b: the received shelf cannot reach the memory substrate ─────────────────

test("MM-3b: received.ts never imports the memory store/validator (AI output cannot compound)", () => {
  const src = read("lib/meet-memory/received.ts");
  assert.ok(!/from\s+["']\.\/store\.ts["']/.test(src), "received must not import store.ts");
  assert.ok(!/from\s+["']\.\/validate\.ts["']/.test(src), "received must not import validate.ts");
  assert.ok(!/MeetMemoryStore/.test(src), "received must not reference the memory store");
});

// ── MM-4: forbidden copy over the module (cold-start prompt included) ───────────

test("MM-4: lib/meet-memory sources carry no forbidden term", () => {
  for (const { name, code } of moduleSources()) {
    const hit = findForbiddenTerm(code);
    assert.equal(hit, null, `lib/meet-memory/${name} contains forbidden term: ${hit}`);
  }
});

// ── MM-5 / MM-6: validator boundary ─────────────────────────────────────────────

test("MM-5: AI-authored provenance is refused; owner provenances pass", () => {
  const item = { kind: "have", title: "t", text: "x", tags: [], private: true };
  for (const provenance of ["ai_generated", "agent", "", undefined]) {
    const r = validateNewEntry({ kind: "rig_item", provenance, value: item });
    assert.equal(r.ok, false, `provenance ${String(provenance)} must be refused`);
  }
  for (const provenance of ["owner_written", "owner_imported_confirmed"]) {
    const r = validateNewEntry({ kind: "rig_item", provenance, value: item });
    assert.equal(r.ok, true, `provenance ${provenance} must pass`);
  }
});

test("MM-6: rig_item.private must be an explicit boolean", () => {
  const base = { kind: "have", title: "t", text: "x", tags: [] };
  for (const priv of [undefined, null, "false", 0]) {
    const r = validateNewEntry({
      kind: "rig_item",
      provenance: "owner_written",
      value: { ...base, private: priv },
    });
    assert.equal(r.ok, false, `private=${String(priv)} must be refused`);
  }
  for (const priv of [true, false]) {
    const r = validateNewEntry({
      kind: "rig_item",
      provenance: "owner_written",
      value: { ...base, private: priv },
    });
    assert.equal(r.ok, true);
  }
});

test("MM-5b: unknown kinds are refused (closed set)", () => {
  const r = validateNewEntry({
    kind: "note",
    provenance: "owner_written",
    value: { text: "free" },
  });
  assert.equal(r.ok, false);
});

// ── MM-7: lifecycle on the in-memory backend ────────────────────────────────────

function freshStore(): MeetMemoryStore {
  let n = 0;
  return new MeetMemoryStore(new InMemoryMeetBackend(), {
    now: () => "2026-06-10T00:00:00.000Z",
    genId: () => `id-${++n}`,
  });
}

const ITEM = { kind: "have", title: "工房", text: "活版印刷ができる", tags: ["手仕事"], private: false } as const;

test("MM-7: create / update / remove / clear round-trip", async () => {
  const store = freshStore();
  const e = await store.create({ kind: "rig_item", provenance: "owner_written", value: { ...ITEM, tags: [...ITEM.tags] } });
  assert.equal((await store.list()).length, 1);
  const updated = await store.update(e.entryId, { ...ITEM, tags: [...ITEM.tags], private: true });
  assert.equal(updated.kind === "rig_item" && updated.value.private, true);
  await store.remove(e.entryId);
  assert.equal((await store.list()).length, 0);
  await store.create({ kind: "question", provenance: "owner_written", value: { text: "問い" } });
  await store.clear();
  assert.equal((await store.list()).length, 0);
});

test("MM-7b: question / profile are upserted singletons", async () => {
  const store = freshStore();
  await store.setQuestion("ひとつめ");
  await store.setQuestion("ふたつめ");
  assert.equal(await store.getQuestion(), "ふたつめ");
  assert.equal((await store.listByKind("question")).length, 1);
  await store.setProfile({ displayName: "あや" });
  await store.setProfile({ displayName: "綾" });
  assert.deepEqual(await store.getProfile(), { displayName: "綾" });
  assert.equal((await store.listByKind("profile")).length, 1);
});

test("MM-7c: export → clear → import restores the entries (hybrid backup, v2)", async () => {
  const store = freshStore();
  await store.create({ kind: "rig_item", provenance: "owner_imported_confirmed", value: { ...ITEM, tags: [...ITEM.tags] } });
  await store.setQuestion("今日の問い");
  const dump = await store.exportAll();
  // 記憶装置 層1a: 控えは v2 へ（journal 同梱・ここでは未配線なので空）。
  assert.equal(dump.format, MEET_EXPORT_FORMAT_V2);
  assert.deepEqual(dump.journal, []);
  assert.equal(dump.entries.length, 2);
  await store.clear();
  const report = await store.importBackup(JSON.stringify(dump));
  assert.equal(report.added, 2);
  assert.equal(report.rejected, 0);
  assert.equal(await store.getQuestion(), "今日の問い");
  assert.equal((await store.listRigItems()).length, 1);
});

test("MM-7c2: a v1 控え still imports silently (forward-compatible reader)", async () => {
  const store = freshStore();
  const v1 = {
    format: MEET_EXPORT_FORMAT,
    exportedAt: "2026-06-10T00:00:00.000Z",
    entries: [
      { entryId: "v1-1", provenance: "owner_written", kind: "question", value: { text: "q" }, createdAt: "2026-06-10", updatedAt: "2026-06-10" },
    ],
  };
  const report = await store.importBackup(JSON.stringify(v1));
  assert.equal(report.added, 1);
  assert.equal(report.journalRestored, 0, "a v1 控え carries no journal");
  assert.equal(await store.getQuestion(), "q");
});

// ── MM-8: import fail-closed ────────────────────────────────────────────────────

test("MM-8: import refuses garbage / wrong format / broken entries", async () => {
  const store = freshStore();
  for (const bad of ["not json", JSON.stringify({ format: "other/v1", entries: [] })]) {
    const r = await store.importBackup(bad);
    assert.equal(r.added + r.updated, 0);
    assert.ok(r.warnings.length >= 1);
  }
  const mixed = {
    format: MEET_EXPORT_FORMAT,
    exportedAt: "2026-06-10T00:00:00.000Z",
    entries: [
      { entryId: "ok-1", provenance: "owner_written", kind: "question", value: { text: "q" }, createdAt: "2026-06-10", updatedAt: "2026-06-10" },
      { entryId: "bad-1", provenance: "ai_generated", kind: "question", value: { text: "x" }, createdAt: "2026-06-10", updatedAt: "2026-06-10" },
      { entryId: "bad-2", provenance: "owner_written", kind: "rig_item", value: { kind: "have", title: "t", text: "x", tags: [] }, createdAt: "2026-06-10", updatedAt: "2026-06-10" },
    ],
  };
  const r = await store.importBackup(JSON.stringify(mixed));
  assert.equal(r.added, 1, "only the clean entry lands");
  assert.equal(r.rejected, 2, "AI provenance + missing private are both refused");
});

// ── MM-9: cold-start intake ─────────────────────────────────────────────────────

const GOOD_ITEMS = `[
  { "kind": "have", "title": "工房", "text": "活版印刷ができる", "tags": ["手仕事"], "private": false },
  { "kind": "memory", "title": "原点", "text": "祖父の印刷所で育った", "tags": [], "private": true }
]`;

test("MM-9: bare array, fenced block, prose-wrapped, and {items} all parse", () => {
  const fenced = "はい、まとめました。\n```json\n" + GOOD_ITEMS + "\n```\nどうぞ。";
  const wrapped = `{ "items": ${GOOD_ITEMS} }`;
  for (const paste of [GOOD_ITEMS, fenced, wrapped]) {
    const r = parseColdStartPaste(paste);
    assert.equal(r.items.length, 2, `should parse: ${paste.slice(0, 24)}…`);
  }
});

test("MM-9b: facilitator shape takes the first owner's items with a warning", () => {
  const multi = `[{ "ownerId": "a", "items": ${GOOD_ITEMS} }, { "ownerId": "b", "items": [] }]`;
  const r = parseColdStartPaste(multi);
  assert.equal(r.items.length, 2);
  assert.ok(r.warnings.length >= 1);
});

test("MM-9c: private defaults to TRUE; broken items dropped; never throws", () => {
  const sketchy = `[
    { "kind": "have", "title": "no-flag", "text": "x", "tags": [] },
    { "kind": "nope", "title": "bad-kind", "text": "y", "tags": [], "private": false },
    { "kind": "want", "text": "" }
  ]`;
  const r = parseColdStartPaste(sketchy);
  assert.equal(r.items.length, 1);
  assert.equal(r.items[0].private, true, "missing flag never becomes public");
  assert.ok(r.warnings.length >= 2);
  assert.deepEqual(parseColdStartPaste("そもそもJSONではない").items, []);
  assert.deepEqual(parseColdStartPaste("").items, []);
});

// ── MM-9d/e/f (発表準備便B): 札ブロック形式 — v2 正本の主形式、JSON は黙って互換 ──

test("MM-9d: 札18枚が実往復（parse→store）、種類ごとの非公開既定、タグ任意", async () => {
  const blocks: string[] = [
    "have 活版印刷ができる工房\n名刺や栞を一枚から刷れる。道具ごと手を貸せる。\n活版 印刷",
    "want 週末に一緒にものづくりする仲間\n月に一度、手を動かす集まりをやってみたい。\nものづくり",
    "avoid 深夜の連絡\n夜はつながらない。朝に返す。", // avoid → 非公開既定（タグ行なし）
    "memory 祖父の印刷所で育った\n紙とインクの匂いが原点。", // memory → 非公開既定
    "have 伏せたい常連向けの仕事\n名前は出したくない仕事がある。\n非公開", // have だが「非公開」明記
    "have タグなしのカード\nタグ行が無くても本文だけで通る。",
  ];
  while (blocks.length < 18) {
    blocks.push(`have 本当に持っている道具その${blocks.length}\n日々使っている道具の一つ。\n道具`);
  }
  const paste = blocks.join("\n\n");
  const r = parseColdStartPaste(paste);
  assert.equal(r.items.length, 18, "18枚すべて読める");
  assert.equal(r.warnings.length, 0, "壊れカードなし＝警告なし");

  const byTitle = (t: string) => r.items.find((it) => it.title === t)!;
  // 種類ごとの非公開既定
  assert.equal(byTitle("深夜の連絡").private, true, "avoid は非公開既定");
  assert.equal(byTitle("祖父の印刷所で育った").private, true, "memory は非公開既定");
  assert.equal(byTitle("伏せたい常連向けの仕事").private, true, "have でも「非公開」明記で伏せる");
  assert.equal(byTitle("活版印刷ができる工房").private, false, "have は既定で公開（owner が確認で選ぶ）");
  // タグ任意・「非公開」はタグから除かれる
  assert.deepEqual(byTitle("タグなしのカード").tags, []);
  assert.deepEqual(byTitle("活版印刷ができる工房").tags, ["活版", "印刷"]);
  assert.ok(!byTitle("伏せたい常連向けの仕事").tags.includes("非公開"));

  // 実往復: 確認フローと同じ provenance で owner-local store に積んで読み戻す
  const store = freshStore();
  for (const item of r.items) {
    await store.create({
      kind: "rig_item",
      provenance: "owner_imported_confirmed",
      value: { ...item, tags: [...item.tags] },
    });
  }
  assert.equal((await store.listRigItems()).length, 18, "18枚が owner-local に着地");
});

test("MM-9e: JSON は札形式導入後も黙って受け続ける（互換・告知しない）", () => {
  const r = parseColdStartPaste(GOOD_ITEMS);
  assert.equal(r.items.length, 2, "旧 JSON 出力が引き続き通る");
  assert.equal(r.items[0].kind, "have");
});

test("MM-9f: 壊れたブロックは正直に一枚だけ落ちる（残りは生きる）", () => {
  const good = "have 直せる自転車\n工具と経験がある。\n自転車";
  const broken = "これは種類語で始まらない一枚\nなので読み取れない。"; // 先頭語が種類でない
  const r = parseColdStartPaste([good, broken, good].join("\n\n"));
  assert.equal(r.items.length, 2, "読める2枚は生きる");
  assert.equal(r.warnings.length, 1, "落ちたのは一枚だけ（正直な一枚落ち）");
});

// ── MM-10 (第2便 A): 置いた問い＝want カード — pure helper pins ─────────────────

test("MM-10: draftPlacedQuestion is a want card tagged 問い, text verbatim", () => {
  const q = "  PXを広めるシナジーがある相手を探したい  ";
  const d = draftPlacedQuestion(q);
  assert.equal(d.kind, "want");
  assert.equal(d.text, q.trim());
  assert.deepEqual(d.tags, [PLACED_QUESTION_TAG]);
  assert.equal(d.private, false, "置く is the choice to be findable (toggle can flip before 確定)");
  assert.ok(d.title.length > 0 && d.title.length <= 17, "auto title stays short");
});

test("MM-10b: title draft — first sentence, ellipsis past 16 chars, whitespace folded", () => {
  assert.equal(draftPlacedQuestionTitle("古い納屋を直したい。誰か手を貸して。"), "古い納屋を直したい");
  assert.equal(
    draftPlacedQuestionTitle("PXを広めるシナジーがある相手を探したい"),
    "PXを広めるシナジーがある相手を…",
  );
  assert.equal(draftPlacedQuestionTitle("短い問い"), "短い問い");
  assert.equal(draftPlacedQuestionTitle("a\n b   c"), "a b c");
});

test("MM-10c: isPlacedQuestion — exactly want+問い; ordinary items stay ordinary", () => {
  assert.ok(isPlacedQuestion({ kind: "want", tags: ["問い"] }));
  assert.ok(isPlacedQuestion({ kind: "want", tags: ["手仕事", "問い"] }));
  assert.ok(!isPlacedQuestion({ kind: "want", tags: ["手仕事"] }));
  assert.ok(!isPlacedQuestion({ kind: "have", tags: ["問い"] }));
});

test("MM-10d: a placed question passes the normal validator (no special write path)", () => {
  const r = validateNewEntry({
    kind: "rig_item",
    provenance: "owner_written",
    value: draftPlacedQuestion("週末に床を張る相棒がほしい"),
  });
  assert.deepEqual(r, { ok: true });
});

// ── MM-11/12 (第2便 B): 候補に出すときの書き方 — validator + outbound swap ──────

test("MM-11: publicTitle/publicText are optional strings; odd values refused", () => {
  const base = { kind: "have", title: "t", text: "x", tags: [], private: false };
  const ok = (value: unknown) =>
    validateNewEntry({ kind: "rig_item", provenance: "owner_written", value });
  assert.deepEqual(ok({ ...base }), { ok: true }, "absent stays valid");
  assert.deepEqual(ok({ ...base, publicTitle: "出す題", publicText: "出す文" }), { ok: true });
  assert.equal(ok({ ...base, publicTitle: 5 }).ok, false);
  assert.equal(ok({ ...base, publicText: { a: 1 } }).ok, false);
});

test("MM-12: toPublicView — swap when set, fallback when blank, EXPLICIT PICK", () => {
  const item = {
    kind: "have" as const,
    title: "○○株式会社のCS部門",
    text: "PRIVATE_DETAIL",
    tags: ["仕事"],
    private: false,
    publicTitle: "BtoB SaaS の CS 立ち上げ",
    publicText: "PUBLIC_SAFE",
  };
  const v = toPublicView(item);
  assert.equal(v.title, "BtoB SaaS の CS 立ち上げ");
  assert.equal(v.text, "PUBLIC_SAFE");
  assert.deepEqual(v.tags, ["仕事"]);
  assert.equal(v.private, false);
  assert.ok(!("publicTitle" in v) && !("publicText" in v), "swap fields never ride along");

  // half-set / whitespace falls back — a 書き方 must not blank a published item
  const half = toPublicView({ ...item, publicTitle: "  ", publicText: "PUBLIC_SAFE" });
  assert.equal(half.title, "○○株式会社のCS部門");
  assert.equal(half.text, "PUBLIC_SAFE");
  const none = toPublicView({ kind: "want", title: "t", text: "x", tags: [], private: false });
  assert.equal(none.title, "t");
  assert.equal(none.text, "x");

  assert.ok(hasPublicVariant(item));
  assert.ok(!hasPublicVariant({ ...item, publicTitle: " ", publicText: "" }));
});

// ── MM-13/14 (補遺 E): 伏せたい言葉 — deterministic leak check + the list ───────

test("MM-13: findMaskLeaks — case/width folded; checks the OUTGOING view only", () => {
  const words = ["PX", "Protocol X", "○○株式会社"];
  // the observed leak shape: the masked draft kept the words verbatim
  assert.deepEqual(
    findMaskLeaks(words, "Protocol Xの普及", "PXを広めたい"),
    ["PX", "Protocol X"],
    "verbatim survivors are caught (PX also matches inside Protocol X line)",
  );
  // case + full/half width wobble is absorbed (even the full-width space)
  assert.deepEqual(findMaskLeaks(words, "", "ｐｘ と protocol　x"), ["PX", "Protocol X"]);
  assert.deepEqual(findMaskLeaks(words, "", "ＰＸの話"), ["PX"]);
  // gone from the public phrasing → no warning
  assert.deepEqual(findMaskLeaks(words, "BtoB SaaS の CS 立ち上げ", "中抜きゼロの台帳の話"), []);
  assert.deepEqual(findMaskLeaks([], "PX", "PX"), [], "no list → no check");

  // the PRIVATE body is out of scope: with a 書き方 set, only the public view
  // is what leaves — and only it is scanned
  const item = {
    kind: "have" as const,
    title: "PXの実装",
    text: "Protocol X の中身",
    tags: [],
    private: false,
    publicTitle: "分散プロトコルの実装",
    publicText: "非カストディアルな台帳の中身",
  };
  const view = toPublicView(item);
  assert.deepEqual(findMaskLeaks(words, view.title, view.text), [], "private-side words don't warn");
});

test("MM-13b: parseMaskWords — 、 , ／ / newline split, trim, dedupe", () => {
  assert.deepEqual(parseMaskWords("PX、Protocol X／○○株式会社, PX\n  "), [
    "PX",
    "Protocol X",
    "○○株式会社",
  ]);
  assert.deepEqual(parseMaskWords(""), []);
});

test("MM-14: mask_list is a validated owner-wide singleton (backed up like the rest)", async () => {
  const r = validateNewEntry({
    kind: "mask_list",
    provenance: "owner_written",
    value: { words: ["PX", "Protocol X"] },
  });
  assert.deepEqual(r, { ok: true });
  assert.equal(
    validateNewEntry({ kind: "mask_list", provenance: "owner_written", value: { words: [1] } }).ok,
    false,
    "non-string words refused",
  );
  const store = freshStore();
  assert.deepEqual(await store.getMaskWords(), [], "empty before first save");
  await store.setMaskWords(["PX", "○○株式会社"]);
  assert.deepEqual(await store.getMaskWords(), ["PX", "○○株式会社"]);
  await store.setMaskWords(["PX"]);
  assert.deepEqual(await store.getMaskWords(), ["PX"], "singleton upserts");
});

// ── MM-15 (第4便 B): 検出→タップ適用 — pure mechanics, fail-closed ──────────────

test("MM-15: filterDetections — only words actually present survive (no hallucination)", () => {
  const pairs = [
    { word: "Protocol X", mask: "非保管プロトコル" },
    { word: "PX Box", mask: "配布基盤" },
    { word: "存在しない社名", mask: "どこか" }, // hallucinated — must die
    { word: " ", mask: "x" },
    { word: "protocol x", mask: "dup" }, // folded duplicate
  ];
  const kept = filterDetections(pairs, "PX Boxの配布", "Protocol X を広めたい");
  assert.deepEqual(kept.map((p) => p.word), ["Protocol X", "PX Box"]);
});

test("MM-15b: applyMasks — folded replace, all occurrences, default ●● mask", () => {
  const r = applyMasks("Protocol Xの実装", "ＰＲＯＴＯＣＯＬ　Xを広めたい。protocol xは良い。", [
    { word: "Protocol X", mask: "非保管プロトコル" },
  ]);
  assert.equal(r.title, "非保管プロトコルの実装");
  assert.equal(r.text, "非保管プロトコルを広めたい。非保管プロトコルは良い。");
  // empty mask falls back to the plain default
  const d = applyMasks("PXの話", "PXとPX", [{ word: "PX", mask: "" }]);
  assert.equal(d.title, "●●の話");
  assert.equal(d.text, "●●と●●");
  // no pairs → unchanged
  assert.deepEqual(applyMasks("a", "b", []), { title: "a", text: "b" });
});

test("MM-15c: tap-apply writes the PUBLIC view only — the private body never moves", () => {
  // the UI applies to toPublicView(...) and stores into publicTitle/publicText;
  // pinned here as the pure pipeline: private fields are not inputs of the swap
  const item = {
    kind: "have" as const,
    title: "PX Boxの配布",
    text: "Protocol X を広めたい",
    tags: [],
    private: false,
  };
  const v = toPublicView(item);
  const r = applyMasks(v.title, v.text, [
    { word: "Protocol X", mask: "非保管プロトコル" },
    { word: "PX Box", mask: "配布基盤" },
  ]);
  const masked = { ...item, publicTitle: r.title, publicText: r.text };
  assert.equal(masked.title, "PX Boxの配布", "private title untouched");
  assert.equal(masked.text, "Protocol X を広めたい", "private text untouched");
  const out = toPublicView(masked);
  assert.equal(out.title, "配布基盤の配布");
  assert.equal(out.text, "非保管プロトコル を広めたい", "the original spacing survives");
  // and the byproduct list now catches these words on EVERY item
  const words = mergeMaskWords([], ["Protocol X", "PX Box", "protocol x"]);
  assert.deepEqual(words, ["Protocol X", "PX Box"], "folded dedupe");
  assert.deepEqual(findMaskLeaks(words, "別項目", "PX Boxも使う"), ["PX Box"], "propagates to all items");
  assert.deepEqual(findMaskLeaks(words, out.title, out.text), [], "masked view is clean");
});

// ── MM-17 (c17): 第一信の下書き — edge 単位・端末のみ・複利しない ────────────────

test("MM-17: first-note drafts are edge-keyed upserts (one per peer, isolated)", async () => {
  const store = new FirstNoteStore(new InMemoryKeyedBackend<FirstNoteDraftV1>(), {
    now: () => "2026-06-12T00:00:00.000Z",
  });
  assert.equal(await store.get("aaaa1111"), "", "no draft yet → empty (textarea starts blank)");
  await store.save("aaaa1111", "最初の下書き");
  await store.save("bbbb2222", "別の相手の下書き");
  assert.equal(await store.get("aaaa1111"), "最初の下書き");
  assert.equal(await store.get("bbbb2222"), "別の相手の下書き", "edges never bleed");
  await store.save("aaaa1111", "自分の言葉に直した");
  assert.equal(await store.get("aaaa1111"), "自分の言葉に直した", "an edge holds ONE draft (upsert)");
  await store.remove("aaaa1111");
  assert.equal(await store.get("aaaa1111"), "");
  assert.equal(firstNoteKey("aaaa1111"), "fnote_aaaa1111", "key derives from the peer (edge 単位)");
});

test("MM-17b: tripwire — the draft lane exists ONLY on the device side", () => {
  // server-blind: no Function touches the lane; no migration defines a table
  for (const src of allFunctionSources()) {
    assert.ok(!/first[_-]?note/i.test(src), "a Function references the first-note lane");
  }
  for (const ent of readdirSync(root("migrations"))) {
    const sql = read(`migrations/${ent}`).toLowerCase();
    assert.ok(!/first_?note/.test(sql), `${ent} must not define a first-note table`);
  }
  // the network client never grows a lane for it (送り方はコピー→外部チャネル)
  for (const ent of readdirSync(root("lib/meet-net"), { withFileTypes: true })) {
    if (!ent.name.endsWith(".ts") || ent.name.endsWith(".test.ts")) continue;
    const code = stripComments(read(`lib/meet-net/${ent.name}`));
    assert.ok(!/firstNote|first_note/i.test(code), `lib/meet-net/${ent.name} must not carry the draft`);
  }
  // no compounding: prompt assembly (rig + meet-ai prompt) never reads drafts
  for (const rel of ["lib/rig/rig.ts", "lib/meet-ai/prompt.ts"]) {
    assert.ok(!/firstNote|FirstNote/.test(stripComments(read(rel))), `${rel} must not read the draft lane`);
  }
  // and the lane itself stays as dumb as received: no store/validator import
  const src = read("lib/meet-memory/firstnote.ts");
  assert.ok(!/from\s+["']\.\/store\.ts["']/.test(src), "firstnote must not import store.ts");
  assert.ok(!/from\s+["']\.\/validate\.ts["']/.test(src), "firstnote must not import validate.ts");
  assert.ok(!/MeetMemoryStore/.test(src), "firstnote must not reference the memory store");
});

// ── MM-16 (第7便 B): ひとこと紹介 — owner-saved only, validated, optional ───────

test("MM-16: profile.intro is an optional string; odd values refused; round-trips", async () => {
  const ok = (value: unknown) =>
    validateNewEntry({ kind: "profile", provenance: "owner_written", value });
  assert.deepEqual(ok({ displayName: "あや" }), { ok: true }, "absent intro stays valid");
  assert.deepEqual(ok({ displayName: "あや", intro: "手を動かす場づくりが好き" }), { ok: true });
  assert.equal(ok({ displayName: "あや", intro: 7 }).ok, false);

  const store = freshStore();
  await store.setProfile({ displayName: "あや", intro: "一言" });
  assert.deepEqual(await store.getProfile(), { displayName: "あや", intro: "一言" });
  await store.setProfile({ displayName: "あや" });
  assert.equal((await store.getProfile())?.intro, undefined, "save without intro clears it");
});
