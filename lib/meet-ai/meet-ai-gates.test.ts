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

import {
  buildMeetPrompt,
  toRigPool,
  toRigPoolWithRefs,
  parseProposalReply,
  parseReplyOutcome,
} from "./prompt.ts";
import { probeOllama } from "./generate.ts";
import { buildDetectPrompt, parseDetectReply, buildIntroPrompt, parseIntroReply } from "./mask.ts";
import {
  FIRST_NOTE_PROMPT,
  buildFirstNotePrompt,
  parseFirstNoteReply,
  firstNoteMaterialFor,
} from "./firstnote.ts";
import { gateCardsByProvenance, entryFace, faceOfEntry } from "./provenance.ts";
import { anchorForRecipient, MAX_ANCHOR } from "./anchor.ts";
import { pickPatrolTarget } from "./patrol.ts";
import { MEET_MODELS, DEFAULT_BY_PROVIDER, detectProviderFromKey, findModel } from "./models.ts";
import { toPublicView } from "../meet-memory/public-view.ts";
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

test("MA-4e: 公開用の書き方 — the OTHER side's prompt gets the public phrasing only; SELF keeps grounding on the raw body", () => {
  const itemWithWriting = {
    kind: "have" as const,
    title: "○○株式会社のCS部門",
    text: "SECRET_STORY",
    tags: [],
    private: false,
    publicTitle: "BtoB SaaS の CS 立ち上げ",
    publicText: "MASKED_PUBLIC_TEXT",
  };
  // What OTHER pushed to the pool is the PUBLIC VIEW (the projection swaps it
  // before publish); the viewer's prompt composes that pool.
  const otherPublished: RigOwnerV1 = {
    ownerId: "raw-other-id",
    items: [toPublicView(itemWithWriting)],
  };
  const viewerPool = buildPublicPool([otherPublished], {
    excludeOwnerId: SELF.ownerId,
    ownerRefById: REFS,
  });
  const viewerPrompt = buildMeetPrompt(SELF, viewerPool, "");
  assert.ok(viewerPrompt.includes("MASKED_PUBLIC_TEXT"), "public phrasing reaches the pool");
  assert.ok(!viewerPrompt.includes("SECRET_STORY"), "private text never reaches another prompt");
  assert.ok(!viewerPrompt.includes("○○株式会社"), "private title never reaches another prompt");

  // The owner's OWN prompt still grounds on the raw body (SELF channel).
  const ownPrompt = buildMeetPrompt(
    { ownerId: "raw-other-id", items: [itemWithWriting] },
    [],
    "",
  );
  assert.ok(ownPrompt.includes("SECRET_STORY"), "SELF grounding keeps the real thing");
});

test("MA-4d: toRigPool is fail-closed on kind and keeps arrival order", () => {
  const served: PoolItemPublic[] = [
    { participantRef: "a".repeat(16), ownerRef: "甲", ownerIntro: "", kind: "have", title: "t", text: "x", tags: [], itemRef: "", business: false },
    { participantRef: "b".repeat(16), ownerRef: "乙", ownerIntro: "", kind: "weird", title: "t", text: "y", tags: [], itemRef: "", business: false },
    { participantRef: "c".repeat(16), ownerRef: "丙", ownerIntro: "", kind: "want", title: "t", text: "z", tags: [], itemRef: "", business: false },
  ];
  const rig = toRigPool(served);
  assert.deepEqual(rig.map((r) => r.text), ["x", "z"]);

  // 第7便 C: the ref-carrying variant — stable [p◯] in titles, same map back,
  // ownerRef attribution intact (fail-closed on kind too).
  const { pool, basis } = toRigPoolWithRefs(served);
  assert.deepEqual(pool.map((p) => p.title), ["[p1] t", "[p2] t"]);
  assert.deepEqual(basis, {
    p1: { ownerRef: "甲", title: "t", text: "x" },
    p2: { ownerRef: "丙", title: "t", text: "z" },
  });

  // R2 0010: when the serve carries the stable alias, it rides the basis map —
  // T1 sends it as the edge's basis_item_ref. An empty alias keeps the pre-R2
  // shape exactly (no itemRef key at all).
  const withAlias = toRigPoolWithRefs(
    served.map((s, i) => ({ ...s, itemRef: i === 0 ? "9".repeat(16) : "" })),
  );
  assert.equal(withAlias.basis.p1.itemRef, "9".repeat(16), "alias rides when served");
  assert.ok(!("itemRef" in withAlias.basis.p2), "empty alias → key absent (stable shape)");
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

// ── MA-5c: OBSERVED qwen2.5-coder outputs (第1便 r15_log) + truncation rescue ──
// parsed=true/cards=[] (model said 今日は無い) must be distinguishable from a
// format miss (parsed=false) — the UI shows noneToday vs the verbatim raw.

const QWEN_FENCED_EMPTY = "```json\n[]\n```"; // the one that leaked raw markup
const QWEN_FENCED_ONE =
  '```json\n[\n  {\n    "to": "あや",\n    "line1": "古い町家の納屋 × 活版印刷の工房",\n    "line2": "週末に一緒に作業してみては"\n  }\n]\n```';
const QWEN_FENCED_TWO =
  '```json\n[\n    {\n        "to": "あや",\n        "line1": "[あなた] have: 納屋 × [あや] want: 子どもと作る場",\n        "line2": "納屋で親子の作業環境を"\n    },\n    {\n        "to": "カフェの人",\n        "line1": "[あなた] have: 納屋 × [カフェの人] want: 夜の使い手",\n        "line2": "夜のカフェに納屋の道具を"\n    }\n]\n```';

test("MA-5c: observed fenced replies — empty array is PARSED, not a format miss", () => {
  const empty = parseReplyOutcome(QWEN_FENCED_EMPTY);
  assert.equal(empty.parsed, true, "fenced [] must count as parsed (今日は無い)");
  assert.equal(empty.cards.length, 0);

  const one = parseReplyOutcome(QWEN_FENCED_ONE);
  assert.equal(one.parsed, true);
  assert.equal(one.cards.length, 1);
  assert.equal(one.cards[0].to, "あや");

  const two = parseReplyOutcome(QWEN_FENCED_TWO);
  assert.equal(two.parsed, true);
  assert.deepEqual(two.cards.map((c) => c.to), ["あや", "カフェの人"]);
});

test("MA-5c2: prose-only / broken replies stay parsed=false (raw fallback)", () => {
  for (const raw of ["今日は無い", "{broken", "はい、探してみますね。"]) {
    const r = parseReplyOutcome(raw);
    assert.equal(r.parsed, false, `must be a format miss: ${raw}`);
    assert.equal(r.cards.length, 0);
  }
});

test("MA-5c3: a TRUNCATED array (max-tokens cut) rescues the completed cards", () => {
  const cut =
    '```json\n[\n  {"to": "あや", "line1": "納屋 × 工房", "line2": "週末に一度"},\n  {"to": "カフェの人", "line1": "納屋 × 夜の店", "li';
  const r = parseReplyOutcome(cut);
  assert.equal(r.parsed, true, "rescued prefix counts as parsed");
  assert.equal(r.cards.length, 1, "only the COMPLETED card survives");
  assert.equal(r.cards[0].to, "あや");
  // prose around the array is removed
  const wrapped = `前置きです。\n[{"to":"あや","line1":"x","line2":"y"}]\nどうでしょう。`;
  assert.equal(parseReplyOutcome(wrapped).cards.length, 1);
});

// ── MA-7 (第4便 B): 固有名の検出 — prompt contract + fail-closed parse ──────────

test("MA-7: buildDetectPrompt — targets, restraint, JSON-pair contract", () => {
  const p = buildDetectPrompt("PX Boxの配布", "Protocol X を広めたい");
  assert.ok(p.includes("特定につながる言葉"));
  // 第7便 E: 伝わる言い方 — jargon rides the same lane, meaning unchanged
  assert.ok(p.includes("外の参加者に伝わらない可能性のある言い回し"), "内輪語・専門語 also targeted");
  assert.ok(p.includes("意味を足さない"));
  assert.ok(p.includes("一般的な言葉は拾わない"));
  assert.ok(p.includes("確信が持てない言葉は出さない"), "restraint stated (差し出しすぎは無視される)");
  assert.ok(p.includes('[{"word"'), "JSON pair contract stated");
  assert.ok(p.includes("title: PX Boxの配布"));
  assert.ok(p.includes("text: Protocol X を広めたい"));
});

test("MA-7d (第7便 B / 第8便 C): intro draft — first-meeting plainness + fail-closed parse", () => {
  const p = buildIntroPrompt([
    { kind: "have", title: "工房", text: "活版印刷ができる" },
    { kind: "want", title: "", text: "週末の相棒" },
  ]);
  assert.ok(p.includes("初見の人に伝わる"), "第8便 C: lands with a stranger");
  assert.ok(p.includes("内輪の言葉・固有名・プロジェクト名は使わない"));
  assert.ok(p.includes("日常の言葉で"));
  assert.ok(p.includes("盛らない"), "no-embellishment stated");
  assert.ok(p.includes("60字以内"));
  assert.ok(p.includes('{"intro"'), "JSON contract stated");
  assert.ok(p.includes("- have: 工房 — 活版印刷ができる"));
  assert.ok(p.includes("- want: 週末の相棒"));

  assert.equal(parseIntroReply('{"intro":"手を動かす場づくりが好き"}'), "手を動かす場づくりが好き");
  assert.equal(parseIntroReply('```json\n{"intro":" x "}\n```'), "x");
  for (const junk of ["できません", "{broken", '{"intro":""}', '{"intro":7}', "[]"]) {
    assert.equal(parseIntroReply(junk), null, `must fail closed: ${junk}`);
  }
});

test("MA-7b: parseDetectReply — fenced/prose parse; junk → [] (UI never dies)", () => {
  const body = '[{"word":"Protocol X","mask":"非保管プロトコル"},{"word":"PX Box","mask":"配布基盤"}]';
  for (const raw of [body, "```json\n" + body + "\n```", `見つけました。${body} 以上です。`]) {
    const pairs = parseDetectReply(raw);
    assert.equal(pairs.length, 2);
    assert.deepEqual(pairs[0], { word: "Protocol X", mask: "非保管プロトコル" });
  }
  for (const raw of ["ありません", "{broken", "{}", '"x"', "[]"]) {
    assert.deepEqual(parseDetectReply(raw), [], `must fail closed: ${raw}`);
  }
  // a pair without a word is nothing; a missing mask degrades to ""
  assert.deepEqual(parseDetectReply('[{"word":"","mask":"x"},{"mask":"y"},{"word":"PX"},42]'), [
    { word: "PX", mask: "" },
  ]);
});

// ── MA-9 (第3便 A): provenance gate — invented partners never display ───────────
// FIXTURE: Hiroto's live observation (Ollama qwen2.5-coder:7b, EMPTY pool):
// 4 cards were generated, every addressee invented. Verbatim from the
// test-disclosed facilitator log (r15_log, 2026-06-10).

const OBSERVED_INVENTED_REPLY =
  '```json\n[\n    {\n        "to": "AIエージェントコミュニティ",\n        "line1": "PX Table（MET）の実装基盤 × AIエージェント運用経験を共有",\n        "line2": "相互手挙げ型マッチングとAIエージェントによるプロセス改善について話す"\n    },\n    {\n        "to": "教育出版業界",\n        "line1": "分岐型ナラティブ教材 × 教育コンテンツの設計力",\n        "line2": "数・ことば・空間の3スキルトラックとAIとの連携について話す"\n    },\n    {\n        "to": "飲食業界",\n        "line1": "PX Tableを浸透させたい × 飲食業界への影響",\n        "line2": "非カストディアルな飲食サービスの可能性について話す"\n    },\n    {\n        "to": "AI研究者コミュニティ",\n        "line1": "Qwen3系のローカルLLM運用 × AI研究と開発環境の最適化",\n        "line2": "ローカルマシンでの高速なAIモデル実行について話す"\n    }\n]\n```';

test("MA-9: the OBSERVED invented-partner reply is fully excluded by the gate", () => {
  const cards = parseProposalReply(OBSERVED_INVENTED_REPLY);
  assert.equal(cards.length, 4, "the reply parses — the gate, not the parser, must stop it");
  // the pool sent that day was EMPTY → refs is empty
  const gated = gateCardsByProvenance(cards, {});
  assert.equal(gated.kept.length, 0, "no invented partner may display");
  assert.equal(gated.excluded.length, 4);
});

test("MA-9b: real addressees pass, invented ones drop — original indices kept", () => {
  const cards = parseProposalReply(OBSERVED_INVENTED_REPLY);
  cards.push({ to: "あや", line1: "納屋 × 工房", line2: "週末に一度", line3: "", basisItemId: "" });
  const refs = { あや: "a".repeat(16), カフェの人: "b".repeat(16) };
  const gated = gateCardsByProvenance(cards, refs);
  assert.equal(gated.kept.length, 1);
  assert.equal(gated.kept[0].card.to, "あや");
  assert.equal(gated.kept[0].index, 4, "reading keys stay on the ORIGINAL card index");
  assert.deepEqual(gated.excluded.map((e) => e.index), [0, 1, 2, 3]);
});

test("MA-9c: fail-closed on odd ref values (empty string never resolves)", () => {
  const cards = [{ to: "ゆら", line1: "x", line2: "", line3: "", basisItemId: "" }];
  assert.equal(gateCardsByProvenance(cards, { ゆら: "" }).kept.length, 0);
  assert.equal(gateCardsByProvenance(cards, {}).kept.length, 0);
  assert.equal(gateCardsByProvenance([], { あや: "a".repeat(16) }).kept.length, 0);
});

// ── MA-9d (第7便 C): basis gate — a proposal must show its grounding ────────────

test("MA-9d: with a basis map, basisItemId must resolve AND belong to the addressee", () => {
  const refs = { あや: "a".repeat(16), カフェの人: "b".repeat(16) };
  const basis = {
    p1: { ownerRef: "あや", title: "工房", text: "活版印刷ができる" },
    p2: { ownerRef: "カフェの人", title: "昼カフェ", text: "間借りで開けている" },
  };
  const card = (to: string, basisItemId: string) => ({
    to,
    line1: "x",
    line2: "y",
    line3: "",
    basisItemId,
  });

  // resolvable + addressee's own item → kept
  assert.equal(gateCardsByProvenance([card("あや", "p1")], refs, basis).kept.length, 1);
  // missing basisItemId → drop (no repair)
  assert.equal(gateCardsByProvenance([card("あや", "")], refs, basis).kept.length, 0);
  // basis ref that was never served → drop
  assert.equal(gateCardsByProvenance([card("あや", "p9")], refs, basis).kept.length, 0);
  // ANOTHER participant's item as basis → drop (grounding must be the addressee's)
  assert.equal(gateCardsByProvenance([card("あや", "p2")], refs, basis).kept.length, 0);
  // legacy entries (no basis map) keep the to-only gate — old shelves don't vanish
  assert.equal(gateCardsByProvenance([card("あや", "")], refs).kept.length, 1);
});

test("MA-9e: the format block demands to + basisItemId; parse carries it leniently", () => {
  const p = buildMeetPrompt(SELF, pool(), "");
  assert.ok(p.includes('"basisItemId"'), "format block names basisItemId");
  const reply =
    '[{"to":"あや","line1":"x","line2":"y","basisItemId":" p3 "},{"to":"あや","line1":"x","line2":"y"}]';
  const cards = parseProposalReply(reply);
  assert.equal(cards[0].basisItemId, "p3", "trimmed through parse");
  assert.equal(cards[1].basisItemId, "", "absent → empty (the gate drops it)");
});

// ── MA-9f (rule 9 3行版, 2026-06-11 裁定): the third line rides the card ────────
//
// The LAW demands 3 lines of the model (法文 + format block); the PARSER stays
// lenient — a 2-line card (pre-3行 shelf entries, a model that omits line3)
// renders as-is rather than dropping. Drops belong to the provenance gate
// alone (fail-close is about grounding, not prose length).

test("MA-9f: law + format block carry the 3rd line; parse is lenient about it", () => {
  const p = buildMeetPrompt(SELF, pool(), "");
  assert.ok(p.includes("各提案は3行"), "the law's 3-line shape reaches the prompt");
  assert.ok(
    p.includes("3行目：相手の公開項目から一つだけ、相手の手がかりを平易に書く。"),
    "the 裁定文 of the third line is verbatim in the prompt",
  );
  assert.ok(p.includes('"line3"'), "format block names line3");
  assert.ok(!p.includes("各提案は2行"), "the 2-line shape is extinct (2行には戻さない)");
  const reply =
    '[{"to":"あや","line1":"x","line2":"y","line3":"古い町家の納屋がある人","basisItemId":"p1"},{"to":"あや","line1":"x","line2":"y","basisItemId":"p1"}]';
  const cards = parseProposalReply(reply);
  assert.equal(cards[0].line3, "古い町家の納屋がある人", "line3 survives parse verbatim");
  assert.equal(cards[1].line3, "", "absent line3 → empty string, card NOT dropped");
  const refs = { あや: "a".repeat(16) };
  const basis = { p1: { ownerRef: "あや", title: "納屋", text: "ひと部屋あいている" } };
  assert.equal(
    gateCardsByProvenance(cards, refs, basis).kept.length,
    2,
    "a 2-line card still displays (length is the law's demand, not the gate's)",
  );
});

// ── MA-12 (c11, c13): anchor の宛先反転 — 段階パース＋fail-close verbatim ─────
//
// 式（あなたの X × ［to］の Y）は v3 で LINE 2 に座る（line1=言い切り）。
// v2 在庫は line1 に式。探索は 1行目→2行目→不成立なら line1 先頭80字 verbatim
// — 送信は止めない。受け手側 verbatim 表示の規定は M-10（meet-gates）。

const NO_SHIKI = "納屋で小さな実証の場を開く。"; // 言い切り（式ではない）

test("MA-12: the anchor swaps owners for the recipient (v2在庫形: 式=line1)", () => {
  assert.equal(
    anchorForRecipient("あなたの納屋 × ［みどり］の改装途中の場所", NO_SHIKI, "みどり", "あや"),
    "あなたの改装途中の場所 × ［あや］の納屋",
  );
  // sentence-final 。 must not land mid-anchor after the swap
  assert.equal(
    anchorForRecipient("あなたの納屋 × ［みどり］の改装途中の場所。", "", "みどり", "あや"),
    "あなたの改装途中の場所 × ［あや］の納屋",
  );
  // spacing around × may vary
  assert.equal(
    anchorForRecipient("あなたの納屋×［みどり］の場所", "", "みどり", "あや"),
    "あなたの場所 × ［あや］の納屋",
  );
  // 半角ブラケット（実機 qwen の観測形）も同じ書式として読む — 出力は常に全角
  assert.equal(
    anchorForRecipient("あなたの古い町家の納屋 × [あや]の改装途中の納屋。", "", "あや", "つち"),
    "あなたの改装途中の納屋 × ［つち］の古い町家の納屋",
  );
});

test("MA-12d (c13): v3形 — 式は2行目から取り、1行目（言い切り）は素通りする", () => {
  assert.equal(
    anchorForRecipient(NO_SHIKI, "あなたの納屋 × ［みどり］の改装途中の場所", "みどり", "あや"),
    "あなたの改装途中の場所 × ［あや］の納屋",
  );
  // line1 が式なら（v2在庫）line1 が勝つ — 探索順 1→2
  assert.equal(
    anchorForRecipient(
      "あなたのA × ［みどり］のB",
      "あなたのC × ［みどり］のD",
      "みどり",
      "あや",
    ),
    "あなたのB × ［あや］のA",
  );
  // 散文×散文 → line1 先頭80字 verbatim（三形の最後）
  assert.equal(anchorForRecipient(NO_SHIKI, "別の散文。", "みどり", "あや"), NO_SHIKI);
});

test("MA-12b: parse misses fall back to the verbatim head (fail-close, never block)", () => {
  // truncation — the marker never closes (both lines)
  assert.equal(
    anchorForRecipient("あなたの納屋 × ［みど", "", "みどり", "あや"),
    "あなたの納屋 × ［みど",
  );
  // free-form prose (書式逸脱)
  const prose = "あやさんと納屋で会うのが良いと思います。";
  assert.equal(anchorForRecipient(prose, "", "みどり", "あや"), prose);
  // a different addressee's marker (to mismatch) → verbatim
  assert.equal(
    anchorForRecipient("あなたの納屋 × ［カフェの人］の場所", "", "みどり", "あや"),
    "あなたの納屋 × ［カフェの人］の場所",
  );
  // empty sides / empty sender → verbatim
  assert.equal(
    anchorForRecipient("あなたの × ［みどり］の場所", "", "みどり", "あや"),
    "あなたの × ［みどり］の場所",
  );
  assert.equal(
    anchorForRecipient("あなたの納屋 × ［みどり］の場所", "", "みどり", " "),
    "あなたの納屋 × ［みどり］の場所",
  );
  // verbatim fallback still caps at 80
  const long = "散文。" + "あ".repeat(200);
  assert.equal(anchorForRecipient(long, "", "みどり", "あや").length, MAX_ANCHOR);
});

test("MA-12c: edge names (× や括弧を含む) と組み替え後の80字上限", () => {
  // recipient name containing × — the marker is matched literally
  assert.equal(
    anchorForRecipient("あなたのX × ［A×B］のY", "", "A×B", "あや"),
    "あなたのY × ［あや］のX",
  );
  // sender name carrying brackets rides verbatim (owner-chosen pseudonym)
  assert.equal(
    anchorForRecipient("あなたのX × ［みどり］のY", "", "みどり", "［怪］"),
    "あなたのY × ［［怪］］のX",
  );
  // the 80-char cap applies AFTER recomposition
  const out = anchorForRecipient(
    `あなたの${"納".repeat(60)} × ［みどり］の${"場".repeat(60)}`,
    "",
    "みどり",
    "あや",
  );
  assert.equal(out.length, MAX_ANCHOR);
  assert.ok(out.startsWith("あなたの場"), "the recipient's side leads after the swap");
});

// ── MA-10 (第8便 B): 沈黙の禁止 — every reply lands on a visible face ───────────
// The decision table the UI renders from, pinned per failure path. There is
// no fourth outcome; a generation can never end as nothing on screen.

test("MA-10: every path lands on cards / none-today / raw — never silence", () => {
  const refs = { あや: "a".repeat(16) };
  const basis = { p1: { ownerRef: "あや", title: "工房", text: "活版印刷" } };
  const face = (raw: string, withBasis = true) =>
    entryFace(raw, parseProposalReply(raw), refs, withBasis ? basis : undefined);

  // 旧形式 (no basisItemId) — real input shape from the migration window
  assert.equal(
    face('```json\n[{"to":"あや","line1":"納屋 × 工房","line2":"週末に一度"}]\n```'),
    "none-today",
    "old-format cards are all-excluded → 今日は無い (note + raw fold), not silence",
  );
  // same old-format against a LEGACY entry (no basis map) → still displays
  assert.equal(
    face('```json\n[{"to":"あや","line1":"納屋 × 工房","line2":"週末に一度"}]\n```', false),
    "cards",
  );
  // 散文混じり (Hiroto-style prose reply) — format miss → verbatim raw
  assert.equal(
    face("いい相手が見つかりました。あやさんと話すと良いと思います。ぜひご連絡ください。"),
    "raw",
  );
  // recognized empty
  assert.equal(face("```json\n[]\n```"), "none-today");
  // basis 欠落だけでなく発明相手も同じ面に落ちる
  assert.equal(
    face('```json\n[{"to":"AI研究者コミュニティ","line1":"x","line2":"y","basisItemId":"p1"}]\n```'),
    "none-today",
  );
  // 壊れ JSON
  assert.equal(face('```json\n[{"to":"あや",'), "raw");
  // a valid new-format card passes through to cards
  assert.equal(
    face('```json\n[{"to":"あや","line1":"x","line2":"y","basisItemId":"p1"}]\n```'),
    "cards",
  );
});

test("MA-10b (第9便 A): outcome entries are explicit faces — 見回り endings included", () => {
  const base = { raw: "", cards: [], refs: {} };
  assert.equal(faceOfEntry({ ...base, outcome: "pool-empty" }), "pool-empty");
  assert.equal(faceOfEntry({ ...base, outcome: "error" }), "error");
  // without an outcome the 三面 table applies unchanged
  assert.equal(faceOfEntry({ ...base, raw: "```json\n[]\n```" }), "none-today");
  assert.equal(faceOfEntry({ ...base, raw: "散文だけ" }), "raw");
});

// ── MA-11 (第9便 B): 見回り — the patrol picker's throttles, pinned ─────────────

const PQ = (id: string) => ({ entryId: id, title: id, text: `${id} の本文` });

test("MA-11: patrol runs only connected + placed + 6h elapsed; oldest first", () => {
  const now = "2026-06-10T12:00:00.000Z";
  const base = { connected: true, questions: [PQ("q1"), PQ("q2")], lastRunGlobal: "", lastRunByQuestion: {}, now };

  assert.notEqual(pickPatrolTarget(base), null, "fresh device patrols");
  assert.equal(pickPatrolTarget({ ...base, connected: false }), null, "未接続では走らない");
  assert.equal(pickPatrolTarget({ ...base, questions: [] }), null, "置いた問いが無ければ走らない");
  assert.equal(
    pickPatrolTarget({ ...base, lastRunGlobal: "2026-06-10T07:00:00.000Z" }),
    null,
    "6時間未満は走らない",
  );
  assert.notEqual(
    pickPatrolTarget({ ...base, lastRunGlobal: "2026-06-10T05:59:00.000Z" }),
    null,
    "6時間以上で走る",
  );
  assert.equal(pickPatrolTarget({ ...base, lastRunGlobal: "broken-date" }), null, "壊れた記録は fail-closed");

  // oldest-unpatrolled first; a never-patrolled question beats any timestamp
  const picked = pickPatrolTarget({
    ...base,
    lastRunByQuestion: { q1: "2026-06-09T00:00:00.000Z" },
  });
  assert.equal(picked?.question.entryId, "q2", "never-patrolled first");
  const picked2 = pickPatrolTarget({
    ...base,
    lastRunByQuestion: { q1: "2026-06-01T00:00:00.000Z", q2: "2026-06-09T00:00:00.000Z" },
  });
  assert.equal(picked2?.question.entryId, "q1", "longest-unpatrolled next");
});

// ── MA-6 (fix1): key-prefix provider detection — the owner never picks ──────────

test("MA-6: sk-ant-… → anthropic; other sk-… → openai; else null", () => {
  assert.equal(detectProviderFromKey("sk-ant-abc123"), "anthropic");
  assert.equal(detectProviderFromKey("  sk-ant-xyz  "), "anthropic");
  assert.equal(detectProviderFromKey("sk-proj-abc123"), "openai");
  assert.equal(detectProviderFromKey("sk-abc"), "openai");
  assert.equal(detectProviderFromKey("api-key-123"), null);
  assert.equal(detectProviderFromKey(""), null);
});

test("MA-6b: every per-provider default model exists in the catalog", () => {
  for (const [provider, id] of Object.entries(DEFAULT_BY_PROVIDER)) {
    const m = MEET_MODELS.find((x) => x.id === id);
    assert.ok(m, `default for ${provider} must exist: ${id}`);
    assert.equal(m!.provider, provider, `default for ${provider} must belong to it`);
  }
});

test("MA-6c: ollama model ids resolve dynamically (whatever the machine has)", () => {
  const m = findModel("ollama:qwen2.5-coder:7b");
  assert.equal(m.provider, "ollama");
  assert.equal(m.id, "ollama:qwen2.5-coder:7b");
  assert.ok(m.label.includes("qwen2.5-coder:7b"));
  // unknown non-ollama ids still fall back to the catalog head
  assert.equal(findModel("nonsense").id, MEET_MODELS[0].id);
  assert.equal(findModel("ollama:").id, MEET_MODELS[0].id, "empty ollama name falls back");
});

// ── MA-6d: 「つながっています」 is probe-truth — reachable and unreachable both pinned

test("MA-6d: probeOllama — reachable lists models; unreachable/odd is fail-closed", async () => {
  const realFetch = globalThis.fetch;
  const calls: string[] = [];
  const respond = (impl: () => Promise<Response>) => {
    globalThis.fetch = ((url: string | URL) => {
      calls.push(String(url));
      return impl();
    }) as typeof fetch;
  };
  try {
    // reachable → ok with the machine's installed model names
    respond(async () =>
      new Response(JSON.stringify({ models: [{ name: "qwen2.5-coder:7b" }, { name: "llama3" }] })),
    );
    assert.deepEqual(await probeOllama("http://localhost:11434/"), {
      ok: true,
      models: ["qwen2.5-coder:7b", "llama3"],
    });
    assert.equal(calls.at(-1), "http://localhost:11434/api/tags", "trailing slash normalized");

    // empty endpoint falls back to the default localhost
    respond(async () => new Response(JSON.stringify({ models: [] })));
    assert.deepEqual(await probeOllama("  "), { ok: true, models: [] });
    assert.equal(calls.at(-1), "http://localhost:11434/api/tags");

    // unreachable (network error) → never claims connected
    respond(async () => {
      throw new TypeError("fetch failed");
    });
    assert.deepEqual(await probeOllama("http://localhost:11434"), { ok: false });

    // reachable but non-2xx → fail-closed
    respond(async () => new Response("nope", { status: 503 }));
    assert.deepEqual(await probeOllama("http://localhost:11434"), { ok: false });

    // reachable but malformed body → fail-closed (no throw, no phantom connect)
    respond(async () => new Response("{broken"));
    assert.deepEqual(await probeOllama("http://localhost:11434"), { ok: false });

    // body without names → ok but zero models (UI must NOT say connected then)
    respond(async () => new Response(JSON.stringify({ models: [{}, { name: 7 }] })));
    assert.deepEqual(await probeOllama("http://localhost:11434"), { ok: true, models: [] });
  } finally {
    globalThis.fetch = realFetch;
  }
});

// ── MA-13 (c17): 第一信の下書き — prompt verbatim・材料・fail-closed parse ──────

test("MA-13: FIRST_NOTE_PROMPT is the c17 指示書 §2 text, verbatim", () => {
  assert.equal(
    FIRST_NOTE_PROMPT,
    [
      "あなたは、ownerの最初のひとことを下書きする取次です。",
      "材料: 提案の3行（接点）、相手の公開項目、ownerの呼び名とひとこと紹介（あれば）。",
      "書き方:",
      "- 届いた接点から始める。自己紹介や挨拶の定型から始めない。",
      "- 1文目: どの接点の話かを自分の言葉で言う（「PXで『◯◯ × ◯◯』という接点が届きました」の形でよい）。",
      "- 2文目: なぜ気になったかを一言。",
      "- 3文目: 相手の公開項目について一つだけ聞く。または、15分で試せる小さな一歩を一つ提案する。",
      "- 全体で2〜4文。敬体。約束・価格・大きな計画は書かない。決めすぎない。",
      "- 出力は本文のみ。前置き・説明・引用符を付けない。",
    ].join("\n"),
  );
});

test("MA-13b: buildFirstNotePrompt — verbatim head; absent materials are omitted", () => {
  const full = buildFirstNotePrompt({
    lines: ["言い切りの一文", "あなたの納屋 × ［あや］の活版印刷", "相手の手がかり"],
    basis: { title: "工房", text: "活版印刷ができる" },
    ownerName: "みどり",
    ownerIntro: "手を動かす場づくりが好き",
  });
  assert.ok(full.startsWith(FIRST_NOTE_PROMPT + "\n"), "instruction rides verbatim at the head");
  assert.ok(full.includes("【材料】"));
  assert.ok(full.includes("- あなたの納屋 × ［あや］の活版印刷"));
  assert.ok(full.includes("相手の公開項目: 工房 — 活版印刷ができる"));
  assert.ok(full.includes("ownerの呼び名: みどり"));
  assert.ok(full.includes("ownerのひとこと紹介: 手を動かす場づくりが好き"));

  // the instruction text itself names every material — judge OMISSION on the
  // 【材料】 block alone
  const thin = buildFirstNotePrompt({ lines: [], basis: null, ownerName: "", ownerIntro: " " });
  const thinMaterials = thin.slice(thin.indexOf("【材料】"));
  assert.ok(!thinMaterials.includes("接点:"), "no lines → no empty heading to hallucinate into");
  assert.ok(!thinMaterials.includes("相手の公開項目"), "no basis → omitted");
  assert.ok(!thinMaterials.includes("呼び名"), "no name → omitted");
  assert.ok(!thinMaterials.includes("ひとこと紹介"), "blank intro → omitted");
  // a title-less basis item renders text-only (no dangling dash)
  const bare = buildFirstNotePrompt({ lines: ["接点"], basis: { title: " ", text: "本文だけ" }, ownerName: "", ownerIntro: "" });
  assert.ok(bare.includes("相手の公開項目: 本文だけ"));
});

test("MA-13c: parseFirstNoteReply — fences/one quote pair stripped; empty → null", () => {
  assert.equal(parseFirstNoteReply("PXで接点が届きました。気になっています。"), "PXで接点が届きました。気になっています。");
  assert.equal(parseFirstNoteReply("```\n本文です。\n```"), "本文です。");
  assert.equal(parseFirstNoteReply("「本文です。」"), "本文です。");
  // inner quotes survive — only a WRAPPING pair is unwrapped
  assert.equal(
    parseFirstNoteReply("PXで『納屋 × 活版印刷』という接点が届きました。"),
    "PXで『納屋 × 活版印刷』という接点が届きました。",
  );
  assert.equal(parseFirstNoteReply(""), null);
  assert.equal(parseFirstNoteReply("   \n  "), null);
  assert.equal(parseFirstNoteReply("``````"), null);
});

test("MA-13d: firstNoteMaterialFor — gate-kept card wins; anchor fallback; invented card never feeds", () => {
  const entry = {
    cards: [
      { to: "実在しない人", line1: "x", line2: "", line3: "", basisItemId: "p9" },
      { to: "あや", line1: "言い切り", line2: "式の行", line3: "", basisItemId: "p1" },
    ],
    refs: { あや: "aaaa1111" },
    basisItems: { p1: { ownerRef: "あや", title: "工房", text: "活版印刷ができる" } },
  };
  // 起点側: the kept card supplies the 3行 (empty line3 dropped) + the basis item
  const m = firstNoteMaterialFor("aaaa1111", [entry], "");
  assert.deepEqual(m.lines, ["言い切り", "式の行"]);
  assert.deepEqual(m.basis, { title: "工房", text: "活版印刷ができる" });
  // an invented addressee resolves nothing — even when it is the only card
  const invented = firstNoteMaterialFor("zzzz9999", [entry], "届いた接点の行");
  assert.deepEqual(invented.lines, ["届いた接点の行"], "anchor fallback (応答側)");
  assert.equal(invented.basis, null);
  // no entries + no anchor → thin material, never a throw
  assert.deepEqual(firstNoteMaterialFor("aaaa1111", [], " "), { lines: [], basis: null });
});
