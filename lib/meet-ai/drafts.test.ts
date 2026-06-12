// R2 GOAL — Dock L2/L3 の gate。`node --test`.

import { test } from "node:test";
import assert from "node:assert/strict";

import { buildDockSearchPrompt, buildMeetPrompt } from "./prompt.ts";
import {
  buildNoteDraftPrompt,
  buildContactDraftPrompt,
  contactDraftKeepsPlaceholder,
  CONTACT_PLACEHOLDER,
  buildPublicPhrasingPrompt,
  parsePublicPhrasingReply,
} from "./drafts.ts";
import type { RigOwnerV1, RigPublicPoolItemV1 } from "../rig/rig.ts";

const SELF: RigOwnerV1 = {
  ownerId: "self",
  items: [{ kind: "want", title: "庭", text: "庭仕事の相棒", tags: [], private: true }],
};
const POOL: RigPublicPoolItemV1[] = [
  { ownerRef: "あや", kind: "have", title: "[p1] 工具", text: "貸せます", tags: [] },
];

// ── L2: dock search prompt — 法構造の保存 ───────────────────────────────────────

test("DK-1: dock search keeps the rig block order — received sits BEFORE 問い and law", () => {
  const p = buildDockSearchPrompt(SELF, POOL, "味噌を教わりたい", ["あや: 工具の貸し借り"]);
  const iSelf = p.indexOf("【あなたの記憶");
  const iPool = p.indexOf("【公開候補プール");
  const iRecv = p.indexOf("【届いている提案");
  const iQ = p.indexOf("【今日の問い】");
  const iLaw = p.indexOf("【出会いの法】");
  assert.ok(iSelf >= 0 && iPool > iSelf && iRecv > iPool && iQ > iRecv && iLaw > iQ);
  assert.ok(p.includes("- あや: 工具の貸し借り"));
});

test("DK-2: no received lines → byte-identical to buildMeetPrompt (no empty heading)", () => {
  const ask = "味噌を教わりたい";
  assert.equal(
    buildDockSearchPrompt(SELF, POOL, ask, []),
    buildMeetPrompt(SELF, POOL, ask),
  );
});

// ── L3: ノート下書き ─────────────────────────────────────────────────────────────

test("DR-1: note prompt — materials ride; absent ones omit their heading", () => {
  const p = buildNoteDraftPrompt({ lines: ["庭 × 工具"], basis: null, ownerName: "あや" });
  assert.ok(p.includes("- 庭 × 工具"));
  assert.ok(!p.includes("相手の公開項目:"), "無い材料は見出しごと省く（指示部の語は残る）");
  assert.ok(p.includes("ownerの呼び名: あや"));
  assert.ok(p.includes("相手と、相手のAIが読みます") || p.includes("相手のAIが読みます"));
});

// ── L3: 渡す文面 — 連絡先を発明しない ────────────────────────────────────────────

test("DR-2: contact prompt demands the placeholder; the keep-check is fail-closed", () => {
  const p = buildContactDraftPrompt({ peerName: "カフェの人", ownerName: "あや" });
  assert.ok(p.includes(CONTACT_PLACEHOLDER));
  assert.equal(contactDraftKeepsPlaceholder(`メールが早いです。${CONTACT_PLACEHOLDER}`), true);
  assert.equal(
    contactDraftKeepsPlaceholder("メールはaya@example.comへ"),
    false,
    "差し込み印の無い返事は採らない（発明された宛先を疑う）",
  );
});

// ── L3: 候補化（公開の書き方）────────────────────────────────────────────────────

test("DR-3: phrasing reply parses fail-closed — JSON only, title capped at 16", () => {
  assert.deepEqual(parsePublicPhrasingReply('{"title":"庭仕事","text":"週末の庭仕事を一緒にできる人を探しています"}'), {
    title: "庭仕事",
    text: "週末の庭仕事を一緒にできる人を探しています",
  });
  const fenced = parsePublicPhrasingReply('```json\n{"title":"とてもとても長いタイトルなので切られる","text":"x"}\n```');
  assert.equal(fenced?.title.length, 16);
  assert.equal(parsePublicPhrasingReply("title: 庭"), null, "JSON 以外は null");
  assert.equal(parsePublicPhrasingReply('{"title":"t","text":""}'), null, "空本文は null");
});

test("DR-4: phrasing prompt carries the item verbatim and the c14 principle", () => {
  const p = buildPublicPhrasingPrompt({ title: "T社の件", text: "T社のラインの治具を直した" });
  assert.ok(p.includes("本文: T社のラインの治具を直した"));
  assert.ok(p.includes("新しい事実を足さない"));
});
