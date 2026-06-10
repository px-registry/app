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
import { deriveParticipantRef, isParticipantRef, isOwnerToken } from "./ref.ts";
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

const ITEMS: RigMemoryItemV1[] = [
  { kind: "have", title: "工房", text: "PUBLIC_A", tags: ["手仕事"], private: false },
  { kind: "memory", title: "秘", text: "PRIVATE_SENTINEL", tags: ["内緒"], private: true },
  { kind: "want", title: "場", text: "PUBLIC_B", tags: [], private: false },
];

test("MN-4: private items never leave the device; key set is closed", () => {
  const out = buildOutboundProjection(ITEMS);
  assert.deepEqual(out.map((o) => o.text), ["PUBLIC_A", "PUBLIC_B"], "order preserved, private gone");
  const flat = JSON.stringify(out);
  assert.ok(!flat.includes("PRIVATE_SENTINEL"), "private text must not be projected");
  assert.ok(!flat.includes("内緒"), "private tags must not be projected");
  for (const o of out) {
    assert.deepEqual(Object.keys(o).sort(), ["kind", "position", "tags", "text", "title"]);
  }
});

test("MN-4b: a missing/odd private flag is excluded (fail-closed end-to-end)", () => {
  const sketchy = [
    { kind: "have", title: "no-flag", text: "LEAK", tags: [] },
  ] as unknown as RigMemoryItemV1[];
  assert.equal(buildOutboundProjection(sketchy).length, 0);
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
