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
