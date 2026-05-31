// Block #6 public copy — FROZEN verbatim trip-wire + forbidden-claim scan. node --test.
//
// The frozen JA (the authored original) is asserted VERBATIM against an independent
// copy here, so any future unwitting paraphrase of the boundary lines trips this
// gate (§3: B/D/F especially — the judge/custody/pay core). The forbidden-token
// scan keeps the unannounced/over-claim wording off every surface that renders this.

import { test } from "node:test";
import assert from "node:assert/strict";

import { BLOCK6_COPY, allBlock6CopyStrings, BLOCK6_FORBIDDEN } from "./block6.ts";

// Independent verbatim copy of the FROZEN JA (source of truth = the freeze doc).
// Editing BLOCK6_COPY without editing this trips the gate — that is the point.
const FROZEN_JA = {
  boardHeading: ["あなたの板。あなたが置き、あなたが取り下げられる。"],
  boardBody: [
    "あなたのAIは、あなたの記憶と公開されている板の内容をもとに候補を拾います。",
    "つながるかどうかは、あなたが決めます。",
    "PX は順位づけも、お金のやり取りも、間に入ることもしません。",
  ],
  boardEmpty: ["まだ何も置かれていません。あなたが置いたものから始まります。"],
  boundary: [
    "PX は内容の良し悪しを判定しません（順位づけ・認証・推薦をしません）。",
    "PX はお金のやり取りに入りません。PX への手数料はありません。",
    "PX はあなたの記憶・下書き・連絡の中身を保持しません。",
    "公開したものだけがサーバーに置かれます。取り下げると公開面から消えます。",
    "PX は預かりや lock-in をしません。",
  ],
  takedownOwner: [
    "いつでも取り下げられます。ひとつずつでも、板ごとでも。取り下げると、検索・板・候補の公開面から消えます。PX は公開用の別コピーを作りません。",
  ],
  friendHonesty: ["あなたの板はあなたのもの。残すのも取り下げるのも、いつでもあなたが決められます"],
  browserLocal: [
    "候補を拾う処理は、あなたのブラウザ側で動きます。あなたの記憶はあなたの端末に置かれ、PX のサーバーは見ません。下書きもサーバーに送られません。公開したものだけがサーバーに置かれます。",
    "拾われる候補は提案であって、推薦でも判定でもありません。つながるかはあなたが決めます。",
    "端末やブラウザによって候補の出方は変わります。これは実験的な機能です。",
  ],
  contact: [
    "連絡のきっかけ（Contact Kit）はあなたの端末で作られ、PX を経由しません。そこから先のやり取りは外部ツールで、あなたたちの間で完結します。",
  ],
  report: [
    "気になる内容があれば、置いた本人が取り下げられます。このクローズドなベータでは、必要に応じて運営が公開環境から取り下げることがあります。これは内容の良し悪しを裁定するためではなく、ベータ環境を保つための運用です。",
  ],
} as const;

test("Block6-impl-1: every frozen JA boundary line is wired VERBATIM (paraphrase trips)", () => {
  for (const key of Object.keys(FROZEN_JA) as Array<keyof typeof FROZEN_JA>) {
    assert.deepEqual(BLOCK6_COPY[key].ja, [...FROZEN_JA[key]], `JA for "${key}" must be verbatim`);
  }
});

test("Block6-impl-2: B / D / F canonical boundary lines are present verbatim (the judge/custody/pay core)", () => {
  // The freeze singles these out — assert the load-bearing lines explicitly.
  assert.ok(BLOCK6_COPY.boundary.ja.includes("PX はお金のやり取りに入りません。PX への手数料はありません。"));
  assert.ok(BLOCK6_COPY.boundary.ja.includes("PX は預かりや lock-in をしません。"));
  assert.ok(BLOCK6_COPY.browserLocal.ja.includes("拾われる候補は提案であって、推薦でも判定でもありません。つながるかはあなたが決めます。"));
  assert.ok(
    BLOCK6_COPY.report.ja[0].includes("内容の良し悪しを裁定するためではなく") &&
      BLOCK6_COPY.report.ja[0].includes("ベータ環境を保つための運用です"),
  );
});

test("Block6-impl-3: EN and JA arrays are line-aligned (no half-translated block)", () => {
  for (const block of Object.values(BLOCK6_COPY)) {
    assert.equal(block.en.length, block.ja.length);
    for (const line of [...block.en, ...block.ja]) assert.ok(line.trim().length > 0);
  }
});

test("Block6-impl-4: no forbidden public-claim / unannounced token appears (EN or JA)", () => {
  const surface = allBlock6CopyStrings().join("\n").toLowerCase();
  for (const banned of BLOCK6_FORBIDDEN) {
    assert.ok(!surface.includes(banned.toLowerCase()), `Block #6 copy must not contain "${banned}"`);
  }
  // The forbidden set itself covers the freeze list + the unannounced-claim markers.
  for (const required of ["保証", "verified", "trusted", "full attestation", "stage c", "layer c"]) {
    assert.ok(BLOCK6_FORBIDDEN.includes(required), `the gate must scan for "${required}"`);
  }
});
