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

import { buildMeetPrompt, toRigPool, parseProposalReply, parseReplyOutcome } from "./prompt.ts";
import { probeOllama } from "./generate.ts";
import { buildDetectPrompt, parseDetectReply } from "./mask.ts";
import { gateCardsByProvenance } from "./provenance.ts";
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
  assert.ok(p.includes("一般的な言葉は拾わない"));
  assert.ok(p.includes("確信が持てない言葉は出さない"), "restraint stated (差し出しすぎは無視される)");
  assert.ok(p.includes('[{"word"'), "JSON pair contract stated");
  assert.ok(p.includes("title: PX Boxの配布"));
  assert.ok(p.includes("text: Protocol X を広めたい"));
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
  cards.push({ to: "あや", line1: "納屋 × 工房", line2: "週末に一度" });
  const refs = { あや: "a".repeat(16), カフェの人: "b".repeat(16) };
  const gated = gateCardsByProvenance(cards, refs);
  assert.equal(gated.kept.length, 1);
  assert.equal(gated.kept[0].card.to, "あや");
  assert.equal(gated.kept[0].index, 4, "reading keys stay on the ORIGINAL card index");
  assert.deepEqual(gated.excluded.map((e) => e.index), [0, 1, 2, 3]);
});

test("MA-9c: fail-closed on odd ref values (empty string never resolves)", () => {
  const cards = [{ to: "ゆら", line1: "x", line2: "" }];
  assert.equal(gateCardsByProvenance(cards, { ゆら: "" }).kept.length, 0);
  assert.equal(gateCardsByProvenance(cards, {}).kept.length, 0);
  assert.equal(gateCardsByProvenance([], { あや: "a".repeat(16) }).kept.length, 0);
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
