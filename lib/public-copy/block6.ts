// Block #6 — public copy / takedown / browser-local boundary copy (FROZEN).
//
// Source of truth: PX_block6_public_copy_takedown_browserlocal_v2_FROZEN.md
// (GPT boundary/wording pass, frozen). This is the HARD side of "境界と言葉は硬く":
// public claim + data-boundary copy. The JA is the AUTHORED original and is wired
// VERBATIM — never paraphrased (a verbatim trip-wire test guards B/D/F especially).
// The EN is natively drafted to carry the SAME boundary meaning (no over-claim).
//
// What this copy must never do (freeze self-audit): claim full attestation / Stage
// C / Layer C / trust / safety / recommendation, or use the forbidden tokens
// 安全 / 保証 / verified / trusted / 安心して取引 /（PXが）決済. PX judges nothing,
// holds nothing, takes no fee, settles no money. The block6 gate scans for these.
//
// Leaf module: no React, no network, no Cloudflare globals — surfaces import the
// constant and render it (single source of truth, so "wire verbatim" holds).

/** A block of copy: parallel EN / JA lines (one entry = one paragraph / list item). */
export interface Block6Block {
  en: string[];
  ja: string[];
}

export const BLOCK6_COPY = {
  // ── A. Public copy (the board's framing) ──────────────────────────────────────
  boardHeading: {
    en: ["Your board. You place what's on it, and you can take it down."],
    ja: ["あなたの板。あなたが置き、あなたが取り下げられる。"],
  },
  boardBody: {
    en: [
      "Your AI surfaces candidates from your own memory and what is publicly on the board.",
      "Whether you connect is your decision.",
      "PX does not rank, does not handle the money, and does not come between you.",
    ],
    ja: [
      "あなたのAIは、あなたの記憶と公開されている板の内容をもとに候補を拾います。",
      "つながるかどうかは、あなたが決めます。",
      "PX は順位づけも、お金のやり取りも、間に入ることもしません。",
    ],
  },
  boardEmpty: {
    en: ["Nothing has been placed yet. It begins with what you place."],
    ja: ["まだ何も置かれていません。あなたが置いたものから始まります。"],
  },

  // ── B. What PX does not hold / do (boundary statement) ────────────────────────
  boundary: {
    en: [
      "PX does not judge whether content is good or bad (no ranking, no certification, no recommendation).",
      "PX does not enter the exchange of money. There is no fee to PX.",
      "PX does not hold the contents of your memory, drafts, or messages.",
      "Only what you publish is stored on the server. When you take it down, it disappears from the public surface.",
      "PX takes no custody and does not lock you in.",
    ],
    ja: [
      "PX は内容の良し悪しを判定しません（順位づけ・認証・推薦をしません）。",
      "PX はお金のやり取りに入りません。PX への手数料はありません。",
      "PX はあなたの記憶・下書き・連絡の中身を保持しません。",
      "公開したものだけがサーバーに置かれます。取り下げると公開面から消えます。",
      "PX は預かりや lock-in をしません。",
    ],
  },

  // ── C. Takedown (owner retire) + friend-smoke honesty ─────────────────────────
  takedownOwner: {
    en: [
      "You can take it down anytime — one at a time, or the whole board. When you do, it disappears from the public surface of search, the board, and candidates. PX keeps no separate published copy.",
    ],
    ja: [
      "いつでも取り下げられます。ひとつずつでも、板ごとでも。取り下げると、検索・板・候補の公開面から消えます。PX は公開用の別コピーを作りません。",
    ],
  },
  friendHonesty: {
    en: ["Your board is yours. Keeping it up or taking it down is always yours to decide."],
    ja: ["あなたの板はあなたのもの。残すのも取り下げるのも、いつでもあなたが決められます"],
  },

  // ── D. Browser-local limits (no model claim) ──────────────────────────────────
  browserLocal: {
    en: [
      "The work of surfacing candidates runs in your browser. Your memory stays on your device, where PX's servers do not see it. Drafts are not sent to the server either. Only what you publish is stored on the server.",
      "The candidates surfaced are suggestions — not recommendations, not judgments. Whether you connect is your decision.",
      "What surfaces varies by device and browser. This is an experimental feature.",
    ],
    ja: [
      "候補を拾う処理は、あなたのブラウザ側で動きます。あなたの記憶はあなたの端末に置かれ、PX のサーバーは見ません。下書きもサーバーに送られません。公開したものだけがサーバーに置かれます。",
      "拾われる候補は提案であって、推薦でも判定でもありません。つながるかはあなたが決めます。",
      "端末やブラウザによって候補の出方は変わります。これは実験的な機能です。",
    ],
  },

  // ── E. Contact / external tool non-involvement ────────────────────────────────
  contact: {
    en: [
      "The contact starter (Contact Kit) is built on your device and does not pass through PX. From there, your exchange happens in an external tool, between the two of you.",
    ],
    ja: [
      "連絡のきっかけ（Contact Kit）はあなたの端末で作られ、PX を経由しません。そこから先のやり取りは外部ツールで、あなたたちの間で完結します。",
    ],
  },

  // ── F. Abuse / report stance (no content-judgment) ────────────────────────────
  report: {
    en: [
      "If something concerns you, the person who placed it can take it down. In this closed beta, the operators may remove something from the public environment when needed. This is not to judge content as good or bad, but to keep the beta environment running.",
    ],
    ja: [
      "気になる内容があれば、置いた本人が取り下げられます。このクローズドなベータでは、必要に応じて運営が公開環境から取り下げることがあります。これは内容の良し悪しを裁定するためではなく、ベータ環境を保つための運用です。",
    ],
  },
} as const;

export type Block6Key = keyof typeof BLOCK6_COPY;

/** Every Block #6 copy string (EN + JA) — scanned by the block6 forbidden-copy gate. */
export function allBlock6CopyStrings(): string[] {
  const out: string[] = [];
  for (const block of Object.values(BLOCK6_COPY)) {
    out.push(...block.en, ...block.ja);
  }
  return out;
}

/**
 * The forbidden public-claim tokens, from the freeze doc — POSITIVE claim words
 * that must never appear (the boundary lines NEGATE concepts like ranking, so a
 * bare "rank"/"recommend" is fine in a negation; these tokens are not). Plus the
 * unannounced-claim markers (full attestation / Stage C / Layer C) that must not
 * surface yet.
 */
export const BLOCK6_FORBIDDEN: readonly string[] = [
  "安全",
  "保証",
  "verified",
  "trusted",
  "安心して取引",
  "決済",
  "full attestation",
  "stage c",
  "layer c",
];
