// R1.5 rig port gates — explicit roll-up. Run with `node --test`.
//
// The rig pure core is PORTED from px-table (the design/law/lab original):
//   lib/px-work/rig.ts + rig-intake.ts @ px-table main f46f470 (R1: PR #34, #35).
// This px-app copy is the LIVING implementation for the R1.5 five-person deploy.
// These gates pin the port so it cannot silently drift or grow I/O:
//
//   R15-rig-1  port provenance — both files carry the source-commit header
//   R15-rig-2  RIG_LAW frozen — law text matches the original VERBATIM
//              (wording changes are forbidden; a new law version is a new law,
//               decided in px-table first, never edited here)
//   R15-rig-3  no-io — lib/rig sources carry no fetch / provider / persistence
//              symbols (same ban list as px-table's no-io gate)
//   R15-rig-4  self-contained — lib/rig imports only from ./ or node:
//   R15-rig-5  boundary re-assert — buildPublicPool fail-closed (private!==false
//              excluded), ownerRef-only projection, private-leak negative
//              (full proofs live in the ported rig.test.ts / rig-intake.test.ts)

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

import { RIG_LAW, buildPublicPool, buildOwnerPrompt, type RigOwnerV1 } from "./rig.ts";

const here = (rel: string) => new URL(rel, import.meta.url);
const read = (rel: string) => readFileSync(here(rel), "utf8");

// ── R15-rig-1: port provenance pinned in the source comments ────────────────────

test("R15-rig-1: both ported files carry the px-table source commit header", () => {
  for (const rel of ["./rig.ts", "./rig-intake.ts"]) {
    const src = read(rel);
    assert.ok(src.includes("PORTED from px-table"), `${rel}: missing port header`);
    assert.ok(src.includes("f46f470"), `${rel}: missing source commit f46f470`);
  }
});

// ── R15-rig-2: RIG_LAW is frozen — verbatim copy of the px-table original ───────
//
// An INDEPENDENT copy of the law text. If anyone edits the law in rig.ts, this
// test fails. The law is changed in px-table (the law original) or not at all.

const LAW_VERBATIM = [
  "両得 ＋ 一人では届かないC（owner の願いも叶う。与えるだけ＝出さない）。",
  "同ジャンルの似た者同士に留まらず、異ジャンルの相補をよく読む。ただし候補に点数・順位・優劣はつけない。",
  "owner の avoid を跨ぐなら出さない。",
  "スコア・順位・評価をつけない・並べない。中身だけ読む。",
  "出す順番に順位の意味を持たせない。",
  "owner の private / avoid は判断にだけ使い、本文として引用・再掲しない。",
  "良いのが無ければ「今日は無い」。何でも出さない。",
  "相手は実在として断定しない（擬似・実マッチでない）。",
  "各提案2行：①owner のもの × 相手のもの（owner 先）②具体の錨を一つ言い切る。締めは軽く「話してみる」。",
] as const;
const LAW_OUTPUT_VERBATIM = "出力：3〜5枚（少なくてよい）。";

test("R15-rig-2: RIG_LAW rules match the px-table original verbatim", () => {
  assert.deepEqual([...RIG_LAW.rules], [...LAW_VERBATIM]);
  assert.equal(RIG_LAW.output, LAW_OUTPUT_VERBATIM);
});

test("R15-rig-2: RIG_LAW is deeply frozen (no runtime mutation)", () => {
  assert.ok(Object.isFrozen(RIG_LAW), "RIG_LAW must be frozen");
  assert.ok(Object.isFrozen(RIG_LAW.rules), "RIG_LAW.rules must be frozen");
});

// ── R15-rig-3 / R15-rig-4: no-io + self-contained scans over lib/rig ────────────

/** Strip line + block comments so the scan reads code, not prose. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

function rigSources(): Array<{ name: string; code: string }> {
  const out: Array<{ name: string; code: string }> = [];
  for (const ent of readdirSync(here("."), { withFileTypes: true })) {
    if (!ent.name.endsWith(".ts") || ent.name.endsWith(".test.ts")) continue;
    out.push({ name: ent.name, code: stripComments(read(`./${ent.name}`)) });
  }
  return out;
}

test("R15-rig-3: lib/rig carries no network / AI provider / persistence symbol", () => {
  // Same ban list as px-table's no-io gate (lib/px-work/no-io.test.ts).
  const banned = [
    /\bfetch\s*\(/,
    /XMLHttpRequest/,
    /openai/i,
    /anthropic/i,
    /aiProvider/i,
    /\.d1\b/i,
    /DurableObject/,
    /localStorage/,
    /indexedDB/i,
    /\bprisma\b/i,
  ];
  const files = rigSources();
  assert.ok(files.length >= 2, "scan must see the ported sources");
  for (const { name, code } of files) {
    for (const re of banned) {
      assert.ok(!re.test(code), `lib/rig/${name} must not contain ${re}`);
    }
  }
});

test("R15-rig-4: lib/rig imports only from ./ or node: (self-contained)", () => {
  for (const { name, code } of rigSources()) {
    for (const m of code.matchAll(/from\s+["']([^"']+)["']/g)) {
      const spec = m[1];
      assert.ok(
        spec.startsWith("./") || spec.startsWith("node:"),
        `lib/rig/${name} imports outside the rig core: ${spec}`,
      );
    }
  }
});

// ── R15-rig-5: boundary re-assert (roll-up; full proofs in ported tests) ────────

test("R15-rig-5: buildPublicPool stays fail-closed and ownerRef-only", () => {
  const a: RigOwnerV1 = {
    ownerId: "raw-id-a",
    items: [
      { kind: "have", title: "公開", text: "PUBLIC_OK", tags: [], private: false },
      { kind: "memory", title: "秘", text: "PRIVATE_SENTINEL", tags: [], private: true },
    ],
  };
  const b: RigOwnerV1 = {
    ownerId: "raw-id-b",
    items: [{ kind: "want", title: "公開", text: "B_PUBLIC", tags: [], private: false }],
  };
  const refs = new Map([
    ["raw-id-a", "参加者A"],
    ["raw-id-b", "参加者B"],
  ]);
  const pool = buildPublicPool([a, b], { excludeOwnerId: "raw-id-a", ownerRefById: refs });
  // self-exclusion + private exclusion: only B's public item remains
  assert.deepEqual(pool.map((p) => p.text), ["B_PUBLIC"]);
  // ownerRef-only projection: closed key set, no ownerId, no private flag
  assert.deepEqual(Object.keys(pool[0]).sort(), ["kind", "ownerRef", "tags", "text", "title"]);
  // private-leak negative across the assembled prompt
  const prompt = buildOwnerPrompt(b, buildPublicPool([a, b], { excludeOwnerId: "raw-id-b", ownerRefById: refs }));
  assert.ok(!prompt.includes("PRIVATE_SENTINEL"), "another owner's private must never reach a prompt");
  assert.ok(!prompt.includes("raw-id-a") && !prompt.includes("raw-id-b"), "raw ownerId must never reach a prompt");
});
