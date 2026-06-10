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

import { InMemoryMeetBackend } from "./backend.ts";
import { MeetMemoryStore, MEET_EXPORT_FORMAT } from "./store.ts";
import { validateNewEntry } from "./validate.ts";
import { parseColdStartPaste } from "./intake.ts";
import {
  PLACED_QUESTION_TAG,
  draftPlacedQuestion,
  draftPlacedQuestionTitle,
  isPlacedQuestion,
} from "./placed.ts";
import { toPublicView, hasPublicVariant } from "./public-view.ts";
import { parseMaskWords, findMaskLeaks } from "./mask-check.ts";
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

test("MM-7c: export → clear → import restores the entries (hybrid backup)", async () => {
  const store = freshStore();
  await store.create({ kind: "rig_item", provenance: "owner_imported_confirmed", value: { ...ITEM, tags: [...ITEM.tags] } });
  await store.setQuestion("今日の問い");
  const dump = await store.exportAll();
  assert.equal(dump.format, MEET_EXPORT_FORMAT);
  assert.equal(dump.entries.length, 2);
  await store.clear();
  const report = await store.importBackup(JSON.stringify(dump));
  assert.equal(report.added, 2);
  assert.equal(report.rejected, 0);
  assert.equal(await store.getQuestion(), "今日の問い");
  assert.equal((await store.listRigItems()).length, 1);
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
