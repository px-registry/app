// R1.5 meet AI lane gates + prompt proofs. Run with `node --test`.
//
//   MA-1  fetch lives ONLY in generate.ts; localStorage ONLY in keys.ts
//   MA-2  the only fetch hosts are the owner-direct providers (+ the owner's
//         local endpoint) — no PX endpoint, no relay
//   MA-3  forbidden copy over the lane sources
//   MA-4  buildMeetPrompt composes the FROZEN core: law verbatim and after the
//         question; question omitted when empty; no raw ownerId; another
//         owner's private never present (inherited, re-pinned end-to-end)
//   MA-5  reply parsing is fail-closed and never throws; raw is the fallback

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

import { buildMeetPrompt, toRigPool, parseProposalReply } from "./prompt.ts";
import { RIG_LAW, buildPublicPool, type RigOwnerV1 } from "../rig/rig.ts";
import { findForbiddenTerm } from "../meet/forbidden.ts";
import type { PoolItemPublic } from "../meet-net/api.ts";

const root = (rel: string) => new URL(`../../${rel}`, import.meta.url);
const read = (rel: string) => readFileSync(root(rel), "utf8");

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

function laneSources(): Array<{ name: string; code: string }> {
  const out: Array<{ name: string; code: string }> = [];
  for (const ent of readdirSync(root("lib/meet-ai"), { withFileTypes: true })) {
    if (ent.name.endsWith(".ts") && !ent.name.endsWith(".test.ts")) {
      out.push({ name: ent.name, code: stripComments(read(`lib/meet-ai/${ent.name}`)) });
    }
  }
  return out;
}

test("MA-1: fetch only in generate.ts; localStorage only in keys.ts", () => {
  for (const { name, code } of laneSources()) {
    if (name !== "generate.ts") {
      assert.ok(!/\bfetch\s*\(/.test(code), `lib/meet-ai/${name} must not fetch`);
    }
    if (name !== "keys.ts") {
      assert.ok(!/localStorage/.test(code), `lib/meet-ai/${name} must not touch localStorage`);
    }
    assert.ok(!/indexedDB\s*[.(]/.test(code), `lib/meet-ai/${name} must not touch indexedDB`);
  }
});

test("MA-2: generate.ts talks only to the owner-direct providers", () => {
  // RAW source here — the naive comment-stripper would eat the // inside URLs.
  const gen = read("lib/meet-ai/generate.ts");
  const hosts = [...gen.matchAll(/https?:\/\/[a-z0-9.:-]+/gi)].map((m) => m[0]);
  assert.ok(hosts.length >= 2, "provider hosts must be explicit");
  for (const h of hosts) {
    assert.ok(
      h === "https://api.anthropic.com" ||
        h === "https://api.openai.com" ||
        h.startsWith("http://localhost"),
      `unexpected host in generate.ts: ${h}`,
    );
  }
  assert.ok(!/px-registry|\/api\/meet/.test(gen), "no PX endpoint in the AI lane (no relay)");
});

test("MA-3: lane sources carry no forbidden term", () => {
  for (const { name, code } of laneSources()) {
    const hit = findForbiddenTerm(code);
    assert.equal(hit, null, `lib/meet-ai/${name} contains forbidden term: ${hit}`);
  }
});

// ── MA-4: prompt composition ────────────────────────────────────────────────────

const SELF: RigOwnerV1 = {
  ownerId: "raw-self-id",
  items: [
    { kind: "have", title: "工房", text: "活版印刷ができる", tags: ["手仕事"], private: false },
    { kind: "memory", title: "原点", text: "SELF_PRIVATE_OK", tags: [], private: true },
  ],
};
const OTHER: RigOwnerV1 = {
  ownerId: "raw-other-id",
  items: [
    { kind: "want", title: "夜の使い手", text: "OTHER_PUBLIC", tags: [], private: false },
    { kind: "memory", title: "秘", text: "OTHER_PRIVATE_LEAK", tags: [], private: true },
  ],
};
const REFS = new Map([
  ["raw-self-id", "あや"],
  ["raw-other-id", "カフェの人"],
]);

function pool() {
  return buildPublicPool([SELF, OTHER], { excludeOwnerId: SELF.ownerId, ownerRefById: REFS });
}

test("MA-4: law verbatim, question before law, format block after law", () => {
  const p = buildMeetPrompt(SELF, pool(), "PXを広める接点を");
  for (const rule of RIG_LAW.rules) assert.ok(p.includes(rule), `law rule missing: ${rule}`);
  assert.ok(p.includes(RIG_LAW.output));
  const qi = p.indexOf("【今日の問い】");
  const li = p.indexOf("【出会いの法】");
  const fi = p.indexOf("【返答の形】");
  assert.ok(qi >= 0 && li > qi && fi > li, "block order: question < law < format");
  assert.ok(p.includes("PXを広める接点を"));
});

test("MA-4b: empty question omits the block entirely", () => {
  for (const q of ["", "   "]) {
    const p = buildMeetPrompt(SELF, pool(), q);
    assert.ok(!p.includes("【今日の問い】"), "no empty question block");
    for (const rule of RIG_LAW.rules) assert.ok(p.includes(rule));
  }
});

test("MA-4c: end-to-end leak negatives survive the composition", () => {
  const p = buildMeetPrompt(SELF, pool(), "問い");
  assert.ok(p.includes("SELF_PRIVATE_OK"), "own private grounds the SELF block");
  assert.ok(!p.includes("OTHER_PRIVATE_LEAK"), "another owner's private never appears");
  assert.ok(!p.includes("raw-self-id") && !p.includes("raw-other-id"), "no raw ownerId");
  assert.ok(p.includes("カフェの人"), "other participant attributed by ownerRef");
});

test("MA-4d: toRigPool is fail-closed on kind and keeps arrival order", () => {
  const served: PoolItemPublic[] = [
    { participantRef: "a".repeat(16), ownerRef: "甲", kind: "have", title: "t", text: "x", tags: [] },
    { participantRef: "b".repeat(16), ownerRef: "乙", kind: "weird", title: "t", text: "y", tags: [] },
    { participantRef: "c".repeat(16), ownerRef: "丙", kind: "want", title: "t", text: "z", tags: [] },
  ];
  const rig = toRigPool(served);
  assert.deepEqual(rig.map((r) => r.text), ["x", "z"]);
});

// ── MA-5: reply parsing ─────────────────────────────────────────────────────────

test("MA-5: fenced / prose-wrapped / bare JSON replies parse into cards", () => {
  const cards = '[{"to":"カフェの人","line1":"工房 × 夜の店","line2":"火曜の夜に一度。"}]';
  for (const raw of [cards, "はい。\n```json\n" + cards + "\n```", `前置き ${cards} 後置き`]) {
    const r = parseProposalReply(raw);
    assert.equal(r.length, 1);
    assert.equal(r[0].to, "カフェの人");
  }
});

test("MA-5b: junk replies yield [] without throwing (raw stays the fallback)", () => {
  for (const raw of ["今日は無い", "[]", '[{"to":""},{"line1":"x"},42]', "{broken"]) {
    assert.ok(Array.isArray(parseProposalReply(raw)));
  }
  assert.equal(parseProposalReply("今日は無い").length, 0);
});
