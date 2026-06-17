// PX Device Mesh — HLC ＋ 横断 merge（Phase C・verdict G3）。Run: node --test
//
// HLC 単調・全順序、merge の dedup・**収束（両端末で同順）**、順序材料の隔離（ranking 不流入）。
// 配列の比較整列を使わないことは px-guard が編集時に強制するため、ここでは import 隔離を断言する。

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { hlcStamp, hlcReceive, hlcToString, hlcCompare, parseHlc } from "./hlc.ts";
import { dedupByRecordId, orderByHlc, mergeRecords } from "./merge.ts";
import { mergeTalkTimeline, threadTimeline } from "./timeline.ts";

test("HLC-1: stamp は単調（同一/過去 wall で counter を進める）", () => {
  const a = hlcStamp(null, 1000, "n1");
  assert.deepEqual(a, { wall: 1000, counter: 0, node: "n1" });
  const b = hlcStamp(a, 1000, "n1"); // 同一 wall
  assert.equal(b.counter, 1);
  const c = hlcStamp(b, 900, "n1"); // 過去 wall
  assert.equal(c.wall, 1000);
  assert.equal(c.counter, 2);
  const d = hlcStamp(c, 2000, "n1"); // 未来 wall → reset
  assert.deepEqual(d, { wall: 2000, counter: 0, node: "n1" });
});

test("HLC-2: receive は local/remote/now の最大 wall に揃え単調に進む", () => {
  const local = { wall: 1000, counter: 3, node: "n1" };
  const remote = { wall: 1000, counter: 5, node: "n2" };
  const merged = hlcReceive(local, remote, 900, "n1");
  assert.equal(merged.wall, 1000);
  assert.equal(merged.counter, 6, "max(3,5)+1");
});

test("HLC-3: 文字列化は辞書式＝数値順（全順序・node が tie-break）", () => {
  const x = hlcToString({ wall: 1000, counter: 2, node: "n1" });
  const y = hlcToString({ wall: 1000, counter: 10, node: "n1" });
  assert.equal(hlcCompare(x, y), -1, "counter 2 < 10 in lexicographic (zero-padded)");
  const p = hlcToString({ wall: 999, counter: 0, node: "z" });
  const q = hlcToString({ wall: 1000, counter: 0, node: "a" });
  assert.equal(hlcCompare(p, q), -1, "earlier wall first regardless of node");
  assert.deepEqual(parseHlc(x), { wall: 1000, counter: 2, node: "n1" });
});

test("M-1: dedupByRecordId keeps first, drops duplicates", () => {
  const out = dedupByRecordId([{ recordId: "a" }, { recordId: "b" }, { recordId: "a" }]);
  assert.deepEqual(out.map((r) => r.recordId), ["a", "b"]);
});

test("M-2: 収束 — 二端末で分岐した record 集合を双方向 merge → 同じ順序", () => {
  const r1 = { recordId: "r1", createdAt: "2026-06-17T10:00:00.000Z" };
  const r2 = { recordId: "r2", createdAt: "2026-06-17T10:00:05.000Z" };
  const r3 = { recordId: "r3", createdAt: "2026-06-17T10:00:05.000Z" }; // r2 と同時刻 → recordId tie-break
  const shared = { recordId: "rS", createdAt: "2026-06-17T09:00:00.000Z" };
  const deviceA = [shared, r1, r3];
  const deviceB = [r2, shared, r3]; // shared/r3 は両方が持つ（重複）
  const ab = mergeRecords(deviceA, deviceB).map((r) => r.recordId);
  const ba = mergeRecords(deviceB, deviceA).map((r) => r.recordId);
  assert.deepEqual(ab, ba, "merge は可換的に収束する（両端末で同順）");
  assert.deepEqual(ab, ["rS", "r1", "r2", "r3"], "createdAt→recordId の決定的順");
});

test("M-3: hlc があれば hlc 順（createdAt より優先）", () => {
  const a = { recordId: "a", createdAt: "2026-06-17T10:00:00.000Z", hlc: hlcToString({ wall: 2000, counter: 0, node: "n" }) };
  const b = { recordId: "b", createdAt: "2026-06-17T11:00:00.000Z", hlc: hlcToString({ wall: 1000, counter: 0, node: "n" }) };
  // createdAt では a<b だが hlc では b<a。hlc が勝つ。
  assert.deepEqual(orderByHlc([a, b]).map((r) => r.recordId), ["b", "a"]);
});

// ── Phase C.1: legacy↔mesh dual-read（verdict G3）────────────────────────────────

const T = (entryId: string, edgeId: string, kind: string, at: string) => ({ entryId, edgeId, kind, at });

test("DR-1: legacy message ＋ mesh talk-msg が一本の timeline に・(at,entryId) で決定的順", () => {
  // legacy = r15_envelope 由来、mesh = talk-msg 由来。interleaved な at。
  const legacy = [T("env_b", "e1", "in", "2026-06-17T10:00:02.000Z"), T("env_d", "e1", "out", "2026-06-17T10:00:04.000Z")];
  const mesh = [T("env_a", "e1", "out", "2026-06-17T10:00:01.000Z"), T("env_c", "e1", "in", "2026-06-17T10:00:03.000Z")];
  const out = mergeTalkTimeline(legacy, mesh).map((e) => e.entryId);
  assert.deepEqual(out, ["env_a", "env_b", "env_c", "env_d"], "一本の時系列で並ぶ");
});

test("DR-2: entryId dedup（legacy/mesh が同じ message なら二重表示しない）", () => {
  const legacy = [T("env_x", "e1", "in", "2026-06-17T10:00:00.000Z")];
  const mesh = [T("env_x", "e1", "in", "2026-06-17T10:00:00.000Z")]; // 同一 env id（冪等）
  const out = mergeTalkTimeline(legacy, mesh);
  assert.equal(out.length, 1, "同一 entryId は 1 つだけ");
});

test("DR-3: 端末 A/B が入力順に依らず同じ順序（収束）", () => {
  const a1 = [T("e2", "e1", "in", "2026-06-17T10:00:05.000Z"), T("e3", "e1", "out", "2026-06-17T10:00:05.000Z")];
  const a2 = [T("e1", "e1", "in", "2026-06-17T10:00:05.000Z")]; // 全て同時刻 → entryId tie-break
  const deviceA = mergeTalkTimeline(a1, a2).map((e) => e.entryId);
  const deviceB = mergeTalkTimeline(a2, a1).map((e) => e.entryId);
  assert.deepEqual(deviceA, deviceB, "入力順に依らず同順");
  assert.deepEqual(deviceA, ["e1", "e2", "e3"], "同時刻は entryId で決定的");
});

test("DR-4: edge_note / standing note（note-out）は timeline に混ざらない（§15）", () => {
  const lane = [
    T("env_m", "e1", "in", "2026-06-17T10:00:00.000Z"),
    T("note_1", "e1", "note-out", "2026-06-17T10:00:01.000Z"), // standing note = edge_note
  ];
  const out = mergeTalkTimeline(lane).map((e) => e.entryId);
  assert.deepEqual(out, ["env_m"], "note-out は timeline 対象外");
});

test("DR-5: threadTimeline は edgeId で絞る", () => {
  const lane = [T("a", "e1", "in", "t1"), T("b", "e2", "in", "t1"), T("c", "e1", "out", "t2")];
  assert.deepEqual(threadTimeline("e1", lane).map((e) => e.entryId), ["a", "c"]);
});

test("G3-isolation: hlc/merge/sync/client/handoff/timeline は ranking/candidate/matching/pool を import しない", () => {
  const here = (rel: string) => new URL(rel, import.meta.url);
  for (const name of readdirSync(here("./")).filter((f) => /^(hlc|merge|sync|client|handoff|timeline)\.ts$/.test(f))) {
    const code = readFileSync(here(`./${name}`), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
    for (const re of [/from\s+["'][^"']*ranking/i, /from\s+["'][^"']*candidate/i, /from\s+["'][^"']*matching/i, /from\s+["'][^"']*pool/i, /from\s+["'][^"']*meet-ai/i]) {
      assert.ok(!re.test(code), `${name} must not import a ranking path: ${re}`);
    }
  }
});
