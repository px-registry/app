// PX Device Mesh — mesh write mode 判定（cutover-plan v0.2 §B.0）。Run: node --test
//
// effective=min(KV,cap)・off<allowlist<on、fail-closed（欠落/不正/owner不在 → off）、allowlist 判定。
// **server authoritative** の中核ロジック — ここが正しければ endpoint の許否は機械的に従う。

import { test } from "node:test";
import assert from "node:assert/strict";
import { parseMeshMode, effectiveMeshMode, parseAllowlist, meshWriteAllowed, parseHandleAllowlist, bootstrapAllowed } from "./mode.ts";

const A = "a".repeat(32); // 32 hex（isOwnerRef を満たす）
const B = "b".repeat(32);
const C = "c".repeat(32);

test("MODE-1: parseMeshMode は 3 値だけ通す", () => {
  assert.equal(parseMeshMode("off"), "off");
  assert.equal(parseMeshMode("allowlist"), "allowlist");
  assert.equal(parseMeshMode("on"), "on");
  for (const v of ["", "ON", "all", undefined, null, 1, {}, "allow"]) assert.equal(parseMeshMode(v), null);
});

test("MODE-2: effective = min(KV, cap)（9 通り）", () => {
  const cases: Array<[string, string, string]> = [
    ["off", "off", "off"],
    ["off", "allowlist", "off"],
    ["off", "on", "off"],
    ["allowlist", "off", "off"], // KV は cap=off の枠を超えられない
    ["allowlist", "allowlist", "allowlist"],
    ["allowlist", "on", "allowlist"], // KV=on でも cap=allowlist が天井
    ["on", "off", "off"],
    ["on", "allowlist", "allowlist"],
    ["on", "on", "on"],
  ];
  for (const [cap, kv, want] of cases) {
    assert.equal(effectiveMeshMode(cap, kv), want, `cap=${cap} kv=${kv}`);
  }
});

test("MODE-3: fail-closed — 欠落/不正なら off", () => {
  assert.equal(effectiveMeshMode(undefined, "on"), "off"); // cap 欠落
  assert.equal(effectiveMeshMode("on", undefined), "off"); // KV 欠落（読めない含む）
  assert.equal(effectiveMeshMode("on", null), "off"); // KV null（未設定）
  assert.equal(effectiveMeshMode("bogus", "on"), "off"); // cap 不正
  assert.equal(effectiveMeshMode("on", "bogus"), "off"); // KV 不正
  assert.equal(effectiveMeshMode("", ""), "off");
});

test("MODE-4: parseAllowlist は owner_ref 形だけ拾う", () => {
  assert.deepEqual(parseAllowlist(`${A}, ${B}`), [A, B]);
  assert.deepEqual(parseAllowlist(` ${A} `), [A]);
  assert.deepEqual(parseAllowlist(`${A},short,${B}`), [A, B]); // 不正形は捨てる
  assert.deepEqual(parseAllowlist(""), []);
  assert.deepEqual(parseAllowlist(undefined), []);
  assert.deepEqual(parseAllowlist(null), []);
  assert.deepEqual(parseAllowlist("not-hex,zzzz"), []);
});

test("MODE-5: meshWriteAllowed — off は誰も不可", () => {
  assert.equal(meshWriteAllowed("off", A, [A]), false);
});

test("MODE-6: meshWriteAllowed — on は owner_ref 形なら可", () => {
  assert.equal(meshWriteAllowed("on", A, []), true);
  assert.equal(meshWriteAllowed("on", B, [A]), true);
});

test("MODE-7: meshWriteAllowed — allowlist は居る owner だけ", () => {
  assert.equal(meshWriteAllowed("allowlist", A, [A, B]), true);
  assert.equal(meshWriteAllowed("allowlist", C, [A, B]), false); // 外
  assert.equal(meshWriteAllowed("allowlist", A, []), false); // 空 list
});

test("MODE-8: fail-closed — owner_ref 不在/不正は全 mode で不可", () => {
  for (const mode of ["off", "allowlist", "on"] as const) {
    assert.equal(meshWriteAllowed(mode, null, [A]), false);
    assert.equal(meshWriteAllowed(mode, undefined, [A]), false);
    assert.equal(meshWriteAllowed(mode, "", [A]), false);
    assert.equal(meshWriteAllowed(mode, "short", [A]), false);
  }
});

test("MODE-9: parseHandleAllowlist は任意 handle 文字列を拾う（空だけ捨てる）", () => {
  assert.deepEqual(parseHandleAllowlist("alice, bob"), ["alice", "bob"]);
  assert.deepEqual(parseHandleAllowlist(" alice , , bob "), ["alice", "bob"]);
  assert.deepEqual(parseHandleAllowlist(""), []);
  assert.deepEqual(parseHandleAllowlist(undefined), []);
  assert.deepEqual(parseHandleAllowlist(null), []);
});

test("MODE-10: bootstrapAllowed — off は不可・on は handle あれば可", () => {
  assert.equal(bootstrapAllowed("off", "alice", ["alice"]), false);
  assert.equal(bootstrapAllowed("on", "alice", []), true);
  assert.equal(bootstrapAllowed("on", "bob", ["alice"]), true);
});

test("MODE-11: bootstrapAllowed — allowlist は bootstrap list の handle だけ", () => {
  assert.equal(bootstrapAllowed("allowlist", "alice", ["alice", "bob"]), true);
  assert.equal(bootstrapAllowed("allowlist", "carol", ["alice", "bob"]), false); // 外
  assert.equal(bootstrapAllowed("allowlist", "alice", []), false); // 空 list
});

test("MODE-12: bootstrapAllowed — handle 不在は全 mode で不可（fail-closed）", () => {
  for (const mode of ["off", "allowlist", "on"] as const) {
    assert.equal(bootstrapAllowed(mode, null, ["alice"]), false);
    assert.equal(bootstrapAllowed(mode, undefined, ["alice"]), false);
    assert.equal(bootstrapAllowed(mode, "", ["alice"]), false);
  }
});
