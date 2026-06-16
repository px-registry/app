// R1.5 meet surface gates — explicit roll-up. Run with `node --test`.
//
//   M-1  forbidden copy — every label-layer string passes the forbidden scan
//   M-2  forbidden copy — lib/meet + app/meet SOURCES carry no forbidden term
//        (the term list itself, ./forbidden.ts, is excluded from its own scan)
//   M-3  no-io in the UI lane — app/meet + lib/meet sources carry no direct
//        fetch / XHR / localStorage / indexedDB: ALL network and persistence go
//        through the audited lib modules (owner-local store, browser-direct AI,
//        signal client), never inline in a component
//   M-4  non-ranking — no .sort( in app/meet (arrival order is the only order)
//   M-5  law is core-owned — app/meet never hardcodes RIG_LAW text; the law
//        reaches a prompt only through lib/rig's buildOwnerPrompt
//
// Scope note: provider names (anthropic/openai) are banned in lib/rig and
// lib/meet, NOT in the dedicated AI module or its UI — a key screen must name
// the provider the owner connects to.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

import { MEET, allMeetCopyStrings, questionPlaceholderByHour } from "./copy.ts";
import { findForbiddenTerm } from "./forbidden.ts";

const root = (rel: string) => new URL(`../../${rel}`, import.meta.url);
const read = (rel: string) => readFileSync(root(rel), "utf8");

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

function sourcesUnder(relDir: string, opts?: { exclude?: readonly string[] }): Array<{ rel: string; code: string }> {
  const out: Array<{ rel: string; code: string }> = [];
  const walk = (dir: string): void => {
    for (const ent of readdirSync(root(dir), { withFileTypes: true })) {
      const rel = `${dir}/${ent.name}`;
      if (ent.isDirectory()) walk(rel);
      else if (
        /\.(ts|tsx)$/.test(ent.name) &&
        !ent.name.endsWith(".test.ts") &&
        !(opts?.exclude ?? []).includes(ent.name)
      ) {
        out.push({ rel, code: stripComments(read(rel)) });
      }
    }
  };
  walk(relDir);
  return out;
}

// ── M-1: label layer passes the forbidden scan ──────────────────────────────────

test("M-1: every meet copy string is free of forbidden terms", () => {
  const strings = allMeetCopyStrings();
  assert.ok(strings.length > 20, "label layer should be non-trivial");
  for (const s of strings) {
    assert.equal(findForbiddenTerm(s), null, `forbidden term in copy: ${s}`);
  }
});

// ── M-2: sources are free of forbidden terms ────────────────────────────────────

test("M-2: lib/meet + app/meet sources carry no forbidden term", () => {
  const files = [
    ...sourcesUnder("lib/meet", { exclude: ["forbidden.ts"] }),
    ...sourcesUnder("app/meet"),
  ];
  assert.ok(files.length >= 2, "scan must see the meet sources");
  for (const { rel, code } of files) {
    const hit = findForbiddenTerm(code);
    assert.equal(hit, null, `${rel} contains forbidden term: ${hit}`);
  }
});

// ── M-3: no direct I/O in the UI lane ───────────────────────────────────────────

test("M-3: app/meet + lib/meet never touch network/persistence directly", () => {
  const banned = [/\bfetch\s*\(/, /XMLHttpRequest/, /localStorage/, /indexedDB/i];
  for (const { rel, code } of [...sourcesUnder("lib/meet"), ...sourcesUnder("app/meet")]) {
    for (const re of banned) {
      assert.ok(!re.test(code), `${rel} must not contain ${re} (use the audited lib modules)`);
    }
  }
});

test("M-3b: lib/meet names no AI provider (provider lives in its own module)", () => {
  for (const { rel, code } of sourcesUnder("lib/meet", { exclude: ["forbidden.ts"] })) {
    for (const re of [/openai/i, /anthropic/i]) {
      assert.ok(!re.test(code), `${rel} must not reference a provider: ${re}`);
    }
  }
});

// ── M-4: non-ranking — arrival order only ───────────────────────────────────────

test("M-4: app/meet contains no .sort( — arrival order is the only order", () => {
  for (const { rel, code } of sourcesUnder("app/meet")) {
    assert.ok(!/\.sort\s*\(/.test(code), `${rel} must not re-order with .sort(`);
  }
});

// ── M-5: the law is core-owned ──────────────────────────────────────────────────

test("M-5: app/meet never hardcodes RIG_LAW text", () => {
  for (const { rel, code } of sourcesUnder("app/meet")) {
    assert.ok(!code.includes("両得"), `${rel} must not inline law rule text`);
    assert.ok(!code.includes("出会いの法"), `${rel} must not inline the law heading`);
  }
});

// ── M-6 (fix1): the pool is AI-ONLY — no human-browsable list exists ────────────
//
// 公開→「AIの候補に出す」: another participant's items may appear to a HUMAN
// only inside a delivered proposal. The /meet/pool surface was removed and must
// stay removed; the pool fetch exists solely to assemble the AI prompt (home).

test("M-6: no /meet/pool route exists", () => {
  const names = readdirSync(root("app/meet"), { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);
  assert.ok(!names.includes("pool"), "app/meet/pool must not exist (AI-only pool)");
});

test("M-6b: fetchPool is referenced only by the prompt-assembly surface (home)", () => {
  for (const { rel, code } of sourcesUnder("app/meet")) {
    if (rel.endsWith("HomeView.tsx")) continue;
    assert.ok(!/fetchPool/.test(code), `${rel} must not browse the pool (AI-only)`);
  }
});

test("M-6c: the candidate wording replaced 公開 in the meet copy", () => {
  const copy = allMeetCopyStrings().join("\n");
  assert.ok(copy.includes("候補に出す"), "the AIの候補に出す wording exists");
  assert.ok(!copy.includes("公開する"), "the old 公開する action wording is gone");
  assert.ok(copy.includes("人間の一覧には出ません"), "the AI-only fact is stated");
});

// ── M-7 (naming final): 主動詞の対は「探しにいく」／「アンテナを立てる」 ──────────
//
// Hiroto 確定: 結果を約束せず行為だけを名指す。探すのであって、つながるとは
// 言わない。「今日は無い」が返っても嘘にならない名前。英語化する日は "Go find"。
// 便3 改名（Hiroto ゲート済・期待の追従）: 置いておく → アンテナを立てる。
// 2026-06-13 小便（期待の追従）: ひらがな「探しにいく」（Hiroto 指定）／見出しは
// ブランド語 Antenna へ昇格／twoTenses ヘルパー文は退場 — 説明は placeholder
// （時間帯 v1・ゲート済4本）へ畳まれた。

test("M-7: the Antenna 面 verbs are [Run] [＋Antenna]; the 聞く-era wording is extinct", () => {
  // 期待の追従（Hiroto 確定 2026-06-16・墨工房 文言 第3手）: 探しにいく→Run（今動かす・
  // Finds と一貫）／アンテナを立てる→＋Antenna（置いて待つを「＋」で記号化）。
  assert.equal(MEET.home.receive, "Run", "the generate button = Run (今動かす)");
  assert.equal(MEET.home.place.action, "＋Antenna", "the waiting verb = ＋Antenna (置いて待つ)");
  // 期待の追従（Hiroto 確定 2026-06-16・表層語彙統一便）: アンテナ → Antenna（退場語彙）。
  assert.equal(MEET.home.place.confirmHeading, "Antennaを立てる", "confirm card keeps the full verb (Antenna)");
  assert.equal(MEET.home.place.heading, "Antenna", "ブランド語昇格 (2026-06-13)");
  // 時間帯 placeholder v1 — ゲート済 verbatim ＋帯写像（朝/昼/夜/深夜）
  assert.equal(
    MEET.home.question.placeholderMorning,
    "おはようございます。今日は、どんな人や話を見つけてほしいですか。",
  );
  assert.equal(
    MEET.home.question.placeholderDaytime,
    "今日は何を始めますか。探したい人や話を書いてみてください。",
  );
  assert.equal(
    MEET.home.question.placeholderEvening,
    "今夜は、どんな話ができる人がいたらいいですか。",
  );
  assert.equal(
    MEET.home.question.placeholderNight,
    "静かな時間ですね。気になっていることを、書き置きしておきませんか。",
  );
  assert.equal(questionPlaceholderByHour(7), MEET.home.question.placeholderMorning);
  assert.equal(questionPlaceholderByHour(13), MEET.home.question.placeholderDaytime);
  assert.equal(questionPlaceholderByHour(20), MEET.home.question.placeholderEvening);
  assert.equal(questionPlaceholderByHour(2), MEET.home.question.placeholderNight);
  assert.equal(questionPlaceholderByHour(23), MEET.home.question.placeholderNight);
  for (const s of allMeetCopyStrings()) {
    assert.ok(!s.includes("いま聞く"), `聞く-era copy survives: ${s}`);
    assert.ok(!s.includes("提案を受け取る"), `pre-fix1 verb survives: ${s}`);
  }
  // UI sources too — no inline resurrection outside the label layer
  for (const { rel, code } of sourcesUnder("app/meet")) {
    assert.ok(!code.includes("いま聞く"), `${rel} carries 聞く-era wording`);
  }
});

// ── M-8 (第4便): 登録UI の絶滅 — masking is offer-and-tap, never pre-listing ────

test("M-8: no mask-registration wording or keys survive (the list is a byproduct)", () => {
  const mw = MEET.maskWords as Record<string, unknown>;
  for (const dead of ["heading", "note", "placeholder", "save", "saved"]) {
    assert.ok(!(dead in mw), `maskWords.${dead} is registration-era and must not exist`);
  }
  for (const alive of ["offerLead", "maskAll", "pickEach", "keepAsIs", "leakWarn", "historyLine"]) {
    assert.ok(alive in mw, `maskWords.${alive} must exist (offer-and-tap)`);
  }
  for (const s of allMeetCopyStrings()) {
    assert.ok(s !== "伏せたい言葉", `the registration heading survives: ${s}`);
  }
  // the memory page renders no registration card; 伏せ版を下書き is gone too
  for (const { rel, code } of sourcesUnder("app/meet")) {
    assert.ok(!code.includes("maskWords.heading"), `${rel} renders the dead registration card`);
    assert.ok(!code.includes("伏せ版を下書き"), `${rel} carries the replaced draft button`);
  }
});

// ── M-10 (c10, c11改定): 合図カードの判断材料 — 受け手側は加工ゼロ ───────────────
//
// The signal card shows the sender's ひとこと紹介 (their CURRENT published
// intro, copied by the inbox endpoint) and the anchor. The anchor is the
// string the SENDER composed for this recipient (c11: 送信側で受け手宛てに
// 組み替えた文字列。パース不能時は line1 先頭80字の verbatim — see
// lib/meet-ai/anchor.ts, pinned by MA-12). On the RECEIVING side both render
// VERBATIM — no slicing, casing, rewriting. The intro row disappears entirely
// when empty (no empty frame), and carries no label (自書きの一言は地の文と
// して立つ).

test("M-10: signal card renders fromIntro / anchor verbatim; empty intro drops the row", () => {
  const src = read("app/meet/SignalsSection.tsx");
  assert.ok(src.includes("{sig.fromIntro}</p>"), "intro displays as the bare stored value");
  assert.ok(src.includes("{sig.anchor}</p>"), "anchor displays as the bare stored value");
  assert.ok(src.includes('sig.fromIntro.trim() !== ""'), "empty intro renders no row");
  for (const field of ["fromIntro", "anchor"]) {
    assert.ok(
      !new RegExp(
        `${field}\\.(slice|substring|substr|replace|normalize|toUpperCase|toLowerCase|concat|padStart|padEnd)`,
      ).test(src),
      `${field} must not be transformed for display (加工ゼロ)`,
    );
  }
});

// ── M-11 (c17): この接点で話す — 文言・面の構成・連絡メモの従属 ──────────────────
//
// Handoff Lite: the pair card leads with the first-note face; the contact-note
// exchange survives unchanged but subordinate (a fold titled 連絡メモを開く).
// The §3 strings are pinned EXACTLY — they passed Hiroto's naming gate as
// written in the 指示書 and must not drift.

test("M-11: c17 文言 — the gated strings, verbatim", () => {
  assert.equal(MEET.firstNote.eyebrow, "この接点で話す");
  assert.equal(MEET.firstNote.make, "最初の一言を作る");
  assert.equal(MEET.firstNote.copyAction, "コピー");
  assert.equal(MEET.firstNote.assist, "AIが下書きします。送るのはあなたです。");
  assert.equal(
    MEET.firstNote.failed,
    "下書きを作れませんでした。もう一度試すか、自分の言葉でどうぞ。",
  );
  assert.equal(MEET.firstNote.contactOpen, "連絡メモを開く");
});

test("M-11b: the face order stands — eyebrow→接点→basis→作る→textarea→コピー→補助文", () => {
  const src = read("app/meet/SignalsSection.tsx");
  const markers = [
    "MEET.firstNote.eyebrow",
    'className="m-pairline"',
    "MEET.proposal.basisShow",
    "MEET.firstNote.make",
    "<textarea",
    "MEET.firstNote.copyAction",
    "MEET.firstNote.assist",
  ];
  let last = -1;
  for (const m of markers) {
    const i = src.indexOf(m);
    assert.ok(i > last, `face order broken at: ${m}`);
    last = i;
  }
  assert.ok(!/readOnly/.test(src), "the draft textarea stays editable (owner's words win)");
  // the contact exchange follows the face, inside the subordinate fold
  const faceUse = src.indexOf("<TalkFace");
  const fold = src.indexOf('className="m-contactfold"');
  const contact = src.indexOf("<ContactExchange");
  assert.ok(faceUse >= 0 && fold > faceUse && contact > fold, "連絡メモ is subordinate to the face");
  assert.ok(src.includes("MEET.firstNote.contactOpen"), "the fold carries the gated heading");
});

// ── M-12 (c18): 死んだ edge への行為に成功の顔をさせない ─────────────────────────
//
// 話してみる / こちらも話してみる は送信結果を読み、棄却は正直な一行になる。
// 文言は指示書 §3 verbatim。sent 文言はペア単位だと読める形。

test("M-12: c18 文言 — the gated refusal lines + pair-scoped sent, verbatim", () => {
  assert.equal(MEET.home.signals.notInPool, "この相手は、いまは候補に出ていません。");
  assert.equal(MEET.home.signals.nameFirst, "先に呼び名を決めてください。");
  assert.equal(MEET.proposal.talkSent, "この相手には「話してみる」を伝えてあります。");
  assert.equal(MEET.receive.nameWhere, "記憶で書けます", "the reused link wording stands");
});

test("M-12b: both send surfaces read the result and branch on the codes", () => {
  for (const rel of ["app/meet/ProposalEntry.tsx", "app/meet/SignalsSection.tsx"]) {
    const src = read(rel);
    assert.ok(src.includes("peer_not_in_pool"), `${rel} must branch on peer_not_in_pool`);
    assert.ok(src.includes("from_name"), `${rel} must branch on from_name`);
    assert.ok(src.includes("notInPool"), `${rel} must render the dead-edge line`);
    assert.ok(src.includes("nameFirst"), `${rel} must render the name lead-in`);
    assert.ok(src.includes("/meet/memory/#name"), `${rel} must link the existing name field`);
    assert.ok(
      src.includes("MEET.receive.errors.unknown"),
      `${rel} must keep an honest fallback (沈黙の禁止 — no fourth ending)`,
    );
  }
});

// ── M-13 (c18b): 残骸 — 押す前から正直に・一手で片づく・生きた相手は隠れない ─────

test("M-13: 片づける is gated verbatim; the absent line is ONE constant everywhere", () => {
  assert.equal(MEET.home.signals.sweep, "片づける");
  // 同一定数 pin: the line exists once, in the label layer — no surface
  // re-types it (a drifted second wording would break the 約束)
  for (const { rel, code } of sourcesUnder("app/meet")) {
    assert.ok(
      !code.includes("この相手は、いまは候補に出ていません"),
      `${rel} must reference MEET.home.signals.notInPool, not retype the line`,
    );
  }
  for (const rel of ["app/meet/ProposalEntry.tsx", "app/meet/SignalsSection.tsx"]) {
    const src = read(rel);
    assert.ok(src.includes("MEET.home.signals.notInPool"), `${rel} renders the shared constant`);
    assert.ok(src.includes("poolRefs"), `${rel} marks from the pool presence set`);
  }
  // c18c: the mark is NOT gated on sent — a sent card says the line too
  const pe = read("app/meet/ProposalEntry.tsx");
  assert.ok(
    pe.indexOf("MEET.home.signals.notInPool") < pe.indexOf("{!sent && ("),
    "ProposalEntry: the absent line renders before (outside) the !sent gate — sent cards keep it",
  );
  // R2 0010/便3 期待の追従: ペアの mutual flag は edge state へ、閉じ分岐が前置。
  const sec = read("app/meet/SignalsSection.tsx");
  const mutualBranch = sec.slice(
    sec.indexOf("{isClosed ? null : isMutual ? ("),
    sec.indexOf('className="m-contactfold"'),
  );
  assert.ok(
    mutualBranch.includes("MEET.home.signals.notInPool"),
    "SignalsSection: the mutual (sent相当) branch says the line when the peer is absent",
  );
});

test("M-13b (便4): the broom shows ONLY on CLOSED cards; living cards are never silenced", () => {
  const src = read("app/meet/SignalsSection.tsx");
  // 期待の追従: hidden-signals（相手単位・不在限定の過渡形）は退場 — 生きた残骸は
  // T4「閉じる」がサーバの事実として片づけ、箒は閉じた札にだけ出る（構造）。
  assert.ok(!src.includes("addHiddenSignalRef"), "the pair-keyed transitional lane is extinct");
  assert.ok(src.includes("addDismissedEdge"), "dismissal goes through the audited edge-keyed lane");
  // the dismissal filter suppresses CLOSED edges only — a live edge can never be hidden
  assert.match(
    src,
    /sig\.state === "closed" && dismissed\.has\(sig\.edgeId\)/,
    "dismissal is gated on closed state in the filter itself",
  );
  // the live respond block (talkBack/閉じる buttons) carries no broom
  assert.ok(
    !/m-respond[\s\S]{0,900}?signals\.sweep/.test(src),
    "no broom inside the live respond block",
  );
  // no server delete — the hide is the device-local lane only
  assert.ok(!src.includes("fetch("), "no direct network in the UI lane (M-3 restated)");
});

// ── M-9 (第7便 D): 相手の候補から is ONE item — never a browsable list ──────────

test("M-9: the basis fold resolves a single basisItemId; basisItems is never iterated", () => {
  const src = read("app/meet/ProposalEntry.tsx");
  assert.ok(src.includes("basisItems?.[card.basisItemId]"), "single-key lookup renders the fold");
  for (const { rel, code } of sourcesUnder("app/meet")) {
    assert.ok(
      !/basisItems\s*\)?\s*\.\s*map|Object\.(keys|values|entries)\([^)]*basisItems/.test(code),
      `${rel} must not enumerate basisItems (no human-browsable partner list)`,
    );
  }
});
