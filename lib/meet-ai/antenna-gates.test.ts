// 記憶装置 §0.6 — アンテナ候補ループの pin。Run with `node --test`.
//
//   AN-1  候補は誘い・判定でない: プロンプトに文言の床（判定しない・「あなたに必要」
//         ではなく誘い）が立ち、forbidden term を含まない
//   AN-2  parse fail-closed: 壊れた返答は []（throw しない）／text 必須／implicit boolean
//   AN-3  reading 非汚染（第2便 RD-1 継承）: antenna.ts は journal に書かない・fetch 無し
//   AN-4  円環の UI 配線（HomeView 構造 scan）: 候補 ✅ は既存 place 二態（setPlaceDraft）
//         へ載せる（候補から直に書かない＝owner 確認を必ず経る・暗黙も同じ道）／候補生成は
//         journal を読む（buildAntennaPrompt）／そっと（候補スロットに通知・バッジを作らない）

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { buildAntennaPrompt, parseAntennaCandidates } from "./antenna.ts";
import { findForbiddenTerm } from "../meet/forbidden.ts";

const appFile = (rel: string) => new URL(`../../${rel}`, import.meta.url);
const stripAll = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\/[^\n]*/g, "");

// ── AN-1: 誘いの文言床 ──────────────────────────────────────────────────────────

test("AN-1: the candidate prompt is invitation, not judgment, and carries no forbidden term", () => {
  const p = buildAntennaPrompt("【あなたの記憶（読み）】\n[m1] memory: 新しい店を始める");
  assert.ok(p.includes("候補"), "frames output as 候補, not a needed antenna");
  assert.ok(p.includes("判定しない"), "states the 文言床: no judgment");
  assert.ok(p.includes("気になりますか"), "asks discovery (誘い), not assessment");
  assert.ok(p.includes("暗黙"), "implicit antennas are invited (記憶から滲む)");
  assert.ok(p.includes("記憶に無いことは作らない"), "no invention");
  assert.equal(findForbiddenTerm(stripAll(p)), null, "prompt carries no forbidden term (評価 等を避ける)");
});

// ── AN-2: parse fail-closed ─────────────────────────────────────────────────────

test("AN-2: candidate parsing never throws; junk → []; text is required", () => {
  for (const junk of ["", "{broken", "ありません", "{}", "42", '[{"why":"x"}]']) {
    assert.deepEqual(parseAntennaCandidates(junk), [], `junk → []: ${junk}`);
  }
  const good = parseAntennaCandidates(
    '```json\n[{"text":"新しい現場を探す","title":"現場","why":"気になりますか?","implicit":true},{"title":"no text"}]\n```',
  );
  assert.equal(good.length, 1, "the text-less candidate is dropped (fail-closed)");
  assert.equal(good[0].text, "新しい現場を探す");
  assert.equal(good[0].implicit, true);
  // prose-wrapped array still parses
  assert.equal(parseAntennaCandidates('はい。[{"text":"店長を探す"}] どうぞ。').length, 1);
  // implicit defaults to false; non-boolean is coerced to false
  const d = parseAntennaCandidates('[{"text":"x","implicit":"yes"}]');
  assert.equal(d[0].implicit, false);
});

// ── AN-3: reading 非汚染 ────────────────────────────────────────────────────────

test("AN-3: antenna.ts never writes to the journal / substrate / network", () => {
  const src = stripAll(readFileSync(new URL("./antenna.ts", import.meta.url), "utf8"));
  for (const bad of [".append(", ".appendEvent(", ".supersede(", ".restore(", ".put(", ".create("]) {
    assert.ok(!src.includes(bad), `antenna.ts must not call ${bad} (candidate gen reads only)`);
  }
  assert.ok(!/\bfetch\s*\(/.test(src), "antenna.ts must not fetch");
  assert.ok(!src.includes("MemJournalStore") && !src.includes("MeetMemoryStore"), "no store handle");
});

// ── AN-4: 円環の UI 配線 ────────────────────────────────────────────────────────

test("AN-4: candidate ✅ routes through the existing place 二態 (owner confirm), reads journal, stays quiet", () => {
  const src = stripAll(readFileSync(appFile("app/meet/HomeView.tsx"), "utf8"));

  // ✅ = 既存 place 二態へ載せる（候補から直に memory.create しない）
  assert.ok(/placeCandidate\s*=\s*\(/.test(src), "a candidate-place handler exists");
  assert.ok(/placeCandidate[\s\S]{0,200}setPlaceDraft\(\{/.test(src), "✅ seeds placeDraft (the existing 二態 card)");
  // the candidate render's primary action calls placeCandidate (not a direct write)
  assert.ok(/onClick=\{\(\)\s*=>\s*placeCandidate\(candidate\)\}/.test(src), "the 立てる button goes through placeCandidate");

  // 候補生成は journal を読む（reading）— 暗黙も明示も同じ owner-✅ 道
  assert.ok(src.includes("buildAntennaPrompt"), "candidates come from the reading prompt");
  assert.ok(/journal\.list\(\)/.test(src), "candidate gen reads the journal length");

  // そっと: 候補スロットに圧の装置（バッジ・既読・presence）を作らない。
  // スロットは Antenna セクション内 — m-antcand から直後の </section> までに限定。
  const from = src.indexOf("m-antcand");
  const slot = src.slice(from, src.indexOf("</section>", from));
  assert.ok(slot.length > 0 && slot.includes("m-antcand-row"), "the candidate slot region is bounded");
  for (const press of ["m-badge", "既読", "未読", "presence", "通知"]) {
    assert.ok(!slot.includes(press), `candidate slot must not carry pressure device: ${press}`);
  }
});
