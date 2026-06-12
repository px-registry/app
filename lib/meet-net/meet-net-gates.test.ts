// R1.5 meet network lane gates + projection proofs. Run with `node --test`.
//
//   MN-1  fetch lives ONLY in api.ts; localStorage ONLY in local.ts
//   MN-2  no AI provider symbol in this lane (browser-direct AI is lib/meet-ai)
//   MN-3  forbidden copy over the lane sources
//   MN-4  outbound projection runs through the frozen rig-core gate:
//         private !== false never leaves; closed key set; order preserved
//   MN-5  participantRef: deterministic, opaque (≠ token, not reversible-shaped),
//         and the shape guards hold

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

import { buildOutboundProjection } from "./projection.ts";
import {
  projectionSnapshotJson,
  snapshotRowSet,
  snapshotHas,
  snapshotPendingCount,
} from "./snapshot.ts";
import { deriveParticipantRef, isParticipantRef, isOwnerToken } from "./ref.ts";
import { toPublicView } from "../meet-memory/public-view.ts";
import { findForbiddenTerm } from "../meet/forbidden.ts";
import type { RigMemoryItemV1 } from "../rig/rig.ts";

const root = (rel: string) => new URL(`../../${rel}`, import.meta.url);
const read = (rel: string) => readFileSync(root(rel), "utf8");

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

function laneSources(): Array<{ name: string; code: string }> {
  const out: Array<{ name: string; code: string }> = [];
  for (const ent of readdirSync(root("lib/meet-net"), { withFileTypes: true })) {
    if (ent.name.endsWith(".ts") && !ent.name.endsWith(".test.ts")) {
      out.push({ name: ent.name, code: stripComments(read(`lib/meet-net/${ent.name}`)) });
    }
  }
  return out;
}

test("MN-1: fetch only in api.ts; localStorage only in local.ts", () => {
  for (const { name, code } of laneSources()) {
    if (name !== "api.ts") {
      assert.ok(!/\bfetch\s*\(/.test(code), `lib/meet-net/${name} must not fetch`);
    }
    if (name !== "local.ts") {
      assert.ok(!/localStorage/.test(code), `lib/meet-net/${name} must not touch localStorage`);
    }
    assert.ok(!/indexedDB\s*[.(]/.test(code), `lib/meet-net/${name} must not touch indexedDB`);
  }
});

test("MN-2: no AI provider symbol in the network lane", () => {
  for (const { name, code } of laneSources()) {
    for (const re of [/openai/i, /anthropic/i, /ollama/i, /aiProvider/i]) {
      assert.ok(!re.test(code), `lib/meet-net/${name} must not reference ${re}`);
    }
  }
});

test("MN-3: lane sources carry no forbidden term", () => {
  for (const { name, code } of laneSources()) {
    const hit = findForbiddenTerm(code);
    assert.equal(hit, null, `lib/meet-net/${name} contains forbidden term: ${hit}`);
  }
});

// ── MN-4: outbound projection ───────────────────────────────────────────────────

// R2 0010 期待の追従: the projection takes {itemRef, view} pairs now — the
// alias rides explicitly, attached AFTER the rig gate.
const withRefs = (views: RigMemoryItemV1[]) =>
  views.map((view, i) => ({ itemRef: String(i + 1).repeat(16).slice(0, 16), view }));

const ITEMS: RigMemoryItemV1[] = [
  { kind: "have", title: "工房", text: "PUBLIC_A", tags: ["手仕事"], private: false },
  { kind: "memory", title: "秘", text: "PRIVATE_SENTINEL", tags: ["内緒"], private: true },
  { kind: "want", title: "場", text: "PUBLIC_B", tags: [], private: false },
];

test("MN-4: private items never leave the device; key set is closed", () => {
  const out = buildOutboundProjection(withRefs(ITEMS));
  assert.deepEqual(out.map((o) => o.text), ["PUBLIC_A", "PUBLIC_B"], "order preserved, private gone");
  const flat = JSON.stringify(out);
  assert.ok(!flat.includes("PRIVATE_SENTINEL"), "private text must not be projected");
  assert.ok(!flat.includes("内緒"), "private tags must not be projected");
  for (const o of out) {
    assert.deepEqual(Object.keys(o).sort(), ["itemRef", "kind", "position", "tags", "text", "title"]);
  }
  // R2 0010: a PRIVATE item's alias does not leave either — the pairing is
  // per-item, so the dropped item's ref simply never lands in a row.
  assert.ok(!flat.includes("2".repeat(16)), "the private item's alias never leaves");
  assert.deepEqual(out.map((o) => o.itemRef), ["1".repeat(16), "3".repeat(16)], "alias↔row pairing is exact");
});

test("MN-4b: a missing/odd private flag is excluded (fail-closed end-to-end)", () => {
  const sketchy = [
    { kind: "have", title: "no-flag", text: "LEAK", tags: [] },
  ] as unknown as RigMemoryItemV1[];
  assert.equal(buildOutboundProjection(withRefs(sketchy)).length, 0);
});

// ── MN-5: ref derivation ────────────────────────────────────────────────────────

test("MN-5: participantRef is deterministic, 16-hex, and never equals the token", async () => {
  const token = "0123456789abcdef0123456789abcdef";
  const a = await deriveParticipantRef(token);
  const b = await deriveParticipantRef(token);
  assert.equal(a, b, "deterministic");
  assert.ok(isParticipantRef(a), "shape");
  assert.notEqual(a, token);
  assert.ok(!token.includes(a), "ref is not a substring of the token");
  const other = await deriveParticipantRef("f".repeat(32));
  assert.notEqual(a, other, "different tokens → different refs");
});

test("MN-5b: shape guards", () => {
  assert.equal(isOwnerToken("0123456789abcdef0123456789abcdef"), true);
  assert.equal(isOwnerToken("short"), false);
  assert.equal(isOwnerToken(42), false);
  assert.equal(isParticipantRef("0123456789abcdef"), true);
  assert.equal(isParticipantRef("0123456789abcdeg"), false);
  assert.equal(isParticipantRef("0123"), false);
});

// ── MN-6 (第2便 A): published-snapshot identity — one definition everywhere ────

test("MN-6: snapshot round-trip — what was pushed is what snapshotHas finds", () => {
  const items = buildOutboundProjection(withRefs([
    { kind: "want", title: "問いA", text: "本文A", tags: ["問い"], private: false },
    { kind: "have", title: "工房", text: "活版", tags: [], private: false },
    { kind: "memory", title: "秘", text: "PRIVATE", tags: [], private: true },
  ]));
  const snap = projectionSnapshotJson(items);
  assert.ok(snapshotHas(snap, { kind: "want", title: "問いA", text: "本文A", tags: ["問い"] }));
  assert.ok(!snapshotHas(snap, { kind: "memory", title: "秘", text: "PRIVATE", tags: [] }), "private never entered");
  assert.ok(!snapshotHas(snap, { kind: "want", title: "問いA", text: "直した本文", tags: ["問い"] }), "edit changes identity");
  assert.equal(snapshotPendingCount(snap, items), 0);
});

test("MN-6b: pending count — symmetric diff; empty snapshot stays quiet; broken JSON is empty", () => {
  const a = buildOutboundProjection(withRefs([
    { kind: "want", title: "t", text: "x", tags: [], private: false },
  ]));
  const b = buildOutboundProjection(withRefs([
    { kind: "want", title: "t", text: "x2", tags: [], private: false },
  ]));
  const snap = projectionSnapshotJson(a);
  assert.equal(snapshotPendingCount(snap, b), 2, "one removed + one added");
  assert.equal(snapshotPendingCount("", b), 0, "never-published device shows no banner");
  assert.equal(snapshotRowSet("{broken").size, 0);
  assert.ok(!snapshotHas("{broken", { kind: "want", title: "t", text: "x", tags: [] }));
});

// ── MN-7 (第2便 B): the outbound projection carries ONLY the public phrasing ───
// Same shape as the rig backstop: with a 書き方 set, the private title/text of
// that item appear NOWHERE in what leaves the device (the publish payload IS
// this projection, serialized).

test("MN-7: private phrasing of a 書き方-item never survives the outbound projection", () => {
  const items = [
    {
      kind: "have" as const,
      title: "○○株式会社のCS部門",
      text: "SECRET_COMPANY_STORY",
      tags: ["仕事"],
      private: false,
      publicTitle: "BtoB SaaS の CS 立ち上げ",
      publicText: "PUBLIC_SAFE_TEXT",
    },
    { kind: "want" as const, title: "相棒", text: "床を張る人", tags: [], private: false },
    { kind: "memory" as const, title: "秘", text: "FULLY_PRIVATE", tags: [], private: true },
  ];
  const out = JSON.stringify(buildOutboundProjection(withRefs(items.map(toPublicView))));
  assert.ok(out.includes("PUBLIC_SAFE_TEXT") && out.includes("BtoB SaaS の CS 立ち上げ"));
  assert.ok(!out.includes("○○株式会社"), "private title must not leave");
  assert.ok(!out.includes("SECRET_COMPANY_STORY"), "private text must not leave");
  assert.ok(!out.includes("FULLY_PRIVATE"), "private item still gated out entirely");
  assert.ok(!out.includes("publicTitle") && !out.includes("publicText"), "closed key set");
  // untouched items pass through verbatim
  assert.ok(out.includes("床を張る人"));
});

// ── MN-8 (第9便 C): serve count is COUNT-ONLY — no viewer identity column ──────

test("MN-8: r15_question_serve stores no viewer id (one-way dedup only)", () => {
  // strip SQL comments — the pin reads the SCHEMA, not the prose around it
  const sql = read("migrations/0009_r15_question_serve.sql")
    .replace(/--[^\n]*/g, "")
    .toLowerCase();
  assert.ok(sql.includes("create table r15_question_serve"));
  for (const banned of ["viewer", "reader_ref", "from_ref", "me_ref", "token", "display_name"]) {
    assert.ok(!sql.includes(banned), `serve table must not carry a ${banned} column`);
  }
  assert.ok(sql.includes("dedup"), "the one-way dedup token is the only per-viewer trace");
  // and the writer (pool.ts) derives it one-way, never binding the raw viewer
  const pool = read("functions/api/meet/pool.ts");
  assert.ok(/sha-?256/i.test(pool), "dedup is a digest");
  assert.ok(!/INSERT[^;]*viewer/i.test(pool), "no viewer column write");
});
