// R1.5 visual refresh gates — the skin's promises, pinned. Run with `node --test`.
//
//   VR-1  token discipline — every colour literal in meet.css sits on a
//         custom-property definition line (components reference tokens only,
//         so paper/sumi invert the WHOLE surface through the token block)
//   VR-2  iOS ground — background-attachment is banned (fixed pseudo-element
//         carries the scene instead)
//   VR-3  the ring's sacred trio — outer 1.8 / inner 0.4 / gap 6 live as the
//         Ring component's constants (every size derives from them)
//   VR-4  減灯 — no glow filters; the only keyframes are the entrance rise
//         (the pulse is a still point, no 鼓動)
//   VR-5  two phases — the sumi override block exists on html[data-theme]
//   VR-6  --faint is rules & ornament only — never a text colour (the one
//         exception is the resting ring's stroke, an ornament by definition)
//   VR-7  the visual-refresh i18n keys exist in BOTH dictionaries and carry
//         no forbidden term (EN keys are draft, ungated — still scanned)

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { findForbiddenTerm } from "./forbidden.ts";
import { en } from "../i18n/en.ts";
import { ja } from "../i18n/ja.ts";

const root = (rel: string) => new URL(`../../${rel}`, import.meta.url);
const read = (rel: string) => readFileSync(root(rel), "utf8");

const css = () => read("app/meet/meet.css").replace(/\/\*[\s\S]*?\*\//g, "");

const COLOUR = /#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/;

test("VR-1: colour literals appear only in custom-property definitions", () => {
  // declarations are ;-separated; a multi-line gradient stays one declaration
  const decls = css()
    .split(/[;{}]/)
    .map((d) => d.trim())
    .filter((d) => d !== "");
  const offenders = decls.filter((d) => COLOUR.test(d) && !d.startsWith("--"));
  assert.deepEqual(offenders, [], "components must reference tokens, never colour literals");
});

test("VR-2: background-attachment never returns (iOS)", () => {
  assert.ok(!css().includes("background-attachment"), "use the fixed pseudo-element scene");
});

test("VR-3: the Ring component holds the sacred trio 1.8 / 0.4 / 6", () => {
  const ring = read("app/meet/Ring.tsx");
  assert.ok(/const OUTER = 1\.8;/.test(ring), "outer 1.8");
  assert.ok(/const INNER = 0\.4;/.test(ring), "inner 0.4");
  assert.ok(/const GAP = 6;/.test(ring), "gap 6");
  // the close is a real transition in the stylesheet (reduced-motion stops it)
  assert.ok(css().includes("stroke-dashoffset"), "open→pair closes via stroke-dashoffset");
});

test("VR-4: 減灯 — no glow filter; the only keyframes are the entrance rise", () => {
  const c = css();
  assert.ok(!c.includes("drop-shadow"), "no glow filters");
  const keyframes = [...c.matchAll(/@keyframes\s+([\w-]+)/g)].map((m) => m[1]);
  assert.deepEqual(keyframes, ["m-rise"], "no pulse/breathe — the still point stays still");
});

test("VR-5: the sumi phase overrides the same token block", () => {
  const c = css();
  assert.ok(c.includes('html[data-theme="sumi"] .meet-scope'), "sumi override block exists");
  for (const must of ["--ground:", "--ink:", "--sub:", "--scene:", "--shu-lit:"]) {
    const sumi = c.slice(c.indexOf('html[data-theme="sumi"]'));
    assert.ok(sumi.includes(must), `sumi phase re-defines ${must}`);
  }
});

test("VR-6: --faint never colours text (rules & ornament only)", () => {
  // block-wise: any `color: var(--faint)` must belong to a ring selector
  const blocks = css().split("}");
  for (const b of blocks) {
    if (/[^-]color:\s*var\(--faint\)/.test(b)) {
      const selector = b.slice(0, b.indexOf("{"));
      assert.ok(/ring/.test(selector), `--faint as a text colour outside a ring: ${selector.trim()}`);
    }
  }
});

test("VR-8 (c12): JA-fixed for this test — EN toggle hidden, machinery kept", () => {
  const toggles = read("app/meet/MeetToggles.tsx");
  assert.ok(!toggles.includes("setLang"), "the language toggle is hidden (returns in R2)");
  assert.ok(toggles.includes("setThemePref"), "the theme toggle stays");
  const layout = read("app/meet/layout.tsx");
  assert.ok(layout.includes("e.lang='ja'"), "the meet surface pins html lang=ja");
  assert.ok(layout.includes("data-px-lang"), "…and the i18n resolver attribute");
  // the EN draft dictionary survives in code (deleted = a different decision)
  assert.ok(
    Object.keys(en).some((k) => k.startsWith("meet.")),
    "EN draft keys still exist in lib/i18n/en.ts",
  );
});

test("VR-9 (c12): gated copy — placeholder, name-row link", async () => {
  const { MEET } = await import("./copy.ts");
  assert.equal(MEET.home.question.placeholder, "例：近くで一緒に手を動かせる人を探したい");
  assert.equal(MEET.receive.nameWhere, "記憶で書けます");
});

// ── VR-10 (c14): 他人に読める書き方 — the coldstart prompt translates AT INTAKE
//
// 設計原理: 翻訳は、文脈が最も濃い場所で、一度だけ。The block below is the
// 2026-06-11 裁定文 VERBATIM (c12-6's 固有名詞ガード is INTEGRATED into it —
// the old free-standing bullet must be extinct, no duplicate 規定). The
// はじめかた §2 line announces it. Downstream (rule 9 v3's 平易な言い回し)
// leans on this — the law itself stays untouched.

test("VR-10: the legibility block rides the coldstart prompt verbatim", async () => {
  const { COLDSTART_PROMPT } = await import("../meet-memory/coldstart.ts");
  for (const line of [
    "**■ 他人に読める書き方（いちばん大事）**",
    "各項目は、**あなたを知らない人が初めて読んでも意味が取れる**ように書いてください。",
    "- 題は短く。ただし内輪の名前・略語・プロジェクト名ではなく、内容が伝わる言葉で。",
    "- 本文は、その話を一度も聞いたことのない相手に説明するつもりで、1〜3文。何をしている・何を求めている・何を持っているのかが、それだけで分かるように。",
    "- 造語・専門の符号・社内の言い回しは、そのまま使わず、内容の言い換えで書く。",
    "- 会社名・店名・人名・取引先名などの固有名詞は、そのまま書かず、内容が伝わる言い換えにする（例:「◯◯株式会社との取引」→「飲食チェーンとの取引」）。本人の呼び名や連絡先は項目に含めない。",
    "- 本人だけに通じる書き方になっていないか、書き終えたら一度、知らない人の目で読み返してから出力する。",
  ]) {
    assert.ok(COLDSTART_PROMPT.includes(line), `coldstart prompt carries: ${line.slice(0, 24)}…`);
  }
  // c12-6's free-standing bullet is integrated — the old form is extinct
  assert.ok(
    !COLDSTART_PROMPT.includes("言い換えにしてください"),
    "the pre-integration c12-6 wording must not survive (no duplicate 規定)",
  );
  const { MEET } = await import("./copy.ts");
  assert.equal(
    MEET.start.step2.legible,
    "項目は、あなたを知らない人が読んでも分かる言葉でつくられます。",
  );
});

// ── VR-11 (c15): 忘却は owner の行為 — the gated wording, pinned ───────────────

test("VR-11: c15 gated copy — two-step clear, pool notice, intake modes", async () => {
  const { MEET } = await import("./copy.ts");
  assert.equal(MEET.memory.clearAll, "すべて消す");
  assert.equal(MEET.memory.confirmClearN(3), "3件の記憶をすべて消します。元に戻せません。");
  assert.equal(MEET.memory.confirmClearGo, "消す");
  assert.equal(MEET.memory.cancel, "やめる", "the existing word pair serves the confirm");
  assert.equal(
    MEET.memory.poolNotice,
    "候補に出した項目が含まれていました。『候補に出す』を押し直すと反映されます。",
  );
  assert.equal(MEET.intake.addMode, "既存の記憶に追加する");
  assert.equal(MEET.intake.replaceMode, "すべて置き換える");
  // the one-step window.confirm era is over
  assert.ok(!("confirmClear" in MEET.memory), "old confirmClear key is extinct");
  const panel = read("app/meet/memory/MemoryPanel.tsx");
  assert.ok(!panel.includes("window.confirm"), "no browser-native confirm — the two-step UI carries it");
});

// ── VR-12 (c16): 反応チップ「わからない」＋テストの帯 ───────────────────────────
//
// 2026-06-11 Hiroto 裁定「わからないがわかれば対策ができる。テスト項目だと
// わかるようにUIで示す」。チップは知覚系（〜わからない）→行動系（話したい）の
// 並び verbatim。帯は注記＋チップ＋ひとことを一つの計器ユニットに括る
// （research mode 日没の視覚的先行——MEET_FINAL_SPEC §3）。

test("VR-12: c16 — the five chips verbatim, the band, the eyebrow", async () => {
  const { MEET } = await import("./copy.ts");
  assert.deepEqual(
    [...MEET.proposal.readings.options],
    ["面白い", "腑に落ちる", "突飛", "わからない", "話したい"],
    "わからない sits after 突飛 — 知覚系の末尾; 話したい (行動系) stays last",
  );
  assert.equal(MEET.proposal.readings.eyebrow, "テストのしつもん");
  assert.equal(
    MEET.proposal.readings.note,
    "この読みはテストの記録です。提案の質を良くするために進行役が読みます。相手には伝わりません。",
    "the existing notice moved INTO the band, wording untouched",
  );
  // the band is one visual unit: eyebrow leads, note/chips/note-field ride inside
  const entry = read("app/meet/ProposalEntry.tsx");
  const band = entry.slice(entry.indexOf('"m-testband"'));
  assert.ok(entry.includes('className="m-testband"'), "the band wraps the reading editor");
  for (const inside of ["readings.eyebrow", "readings.note", "readings.options", "notePlaceholder"]) {
    assert.ok(band.includes(inside), `${inside} sits inside the band`);
  }
  assert.ok(css().includes(".m-testband"), "the band rule exists (thin rule, tokens only — VR-1 scans it)");
});

test("VR-7: visual-refresh i18n keys — both dictionaries, no forbidden term", () => {
  const enKeys = Object.keys(en).filter((k) => k.startsWith("meet."));
  const jaKeys = Object.keys(ja).filter((k) => k.startsWith("meet."));
  assert.ok(enKeys.length > 0, "the meet.* keys exist");
  assert.deepEqual(jaKeys.sort(), enKeys.sort(), "EN and JA carry the same meet.* key set");
  for (const k of [...enKeys, ...jaKeys]) {
    for (const dict of [en, ja]) {
      const v = dict[k];
      if (typeof v === "string" && v !== "") {
        assert.equal(findForbiddenTerm(v), null, `forbidden term in ${k}: ${v}`);
      }
    }
  }
});
