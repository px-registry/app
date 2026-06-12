// R2 Wave 2 — Dock Lite（spec §12: あなたのAIに聞く＋context preview＋draft only＋PX no-log）。
//
// 原則:
//   * browser 直 — owner の鍵・owner の端末。PX は非中継・非保管（このモジュールは
//     lib/meet-net を import しない — テスト開示レーン submitLog にも触れない。pin 付き）。
//   * context bundle は目的別最小限で、**プレビュー＝送られるものそのもの**:
//     prompt は instructions + preview の合成なので、見せたものと送るものが
//     構造的に一致する（正直は表示の努力でなく構成で担保）。
//   * draft only — 返事は表示するだけ。ここから実行される操作は存在しない。
//
// owner の記憶（private 込み）が bundle に入るのは、生成（buildMeetPrompt の SELF）と
// 同じ階級 — 自分の AI への自分の材料。第三者・PX には一字も行かない。

import type { ProposalCard } from "./prompt.ts";

export type DockMaterial = {
  card: ProposalCard;
  /** 「相手の候補から」の一件（あれば）。 */
  basis: { title: string; text: string } | null;
  /** 相手のひとこと紹介（"" = なし）。 */
  partnerIntro: string;
  /** 読み手自身の記憶（SELF — 生成時と同じ階級・自分の AI へだけ）。 */
  selfItems: Array<{ kind: string; title: string; text: string }>;
};

// 指示部（owner の AI への声がけ — UI 文言ではない）。法の精神を一行で携える:
// 評価・点数・順位はつけない（rule 4 の dock 版）。
const DOCK_INSTRUCTIONS = [
  "あなたは読み手の側に立つAIです。以下は読み手の端末から直接渡された材料です。",
  "この提案について、読み手のために:",
  "1. 提案の中身を平易に説明する",
  "2. 読み手の記憶とどう重なるか（重ならないならそれも正直に）を示す",
  "3. わからない点があれば、何を確かめればよいかを短く挙げる",
  "点数や順位はつけない。比べて選ばない。中身だけ読む。返事はそのまま読める文章で。",
].join("\n");

/** The preview text — EXACTLY what rides into the prompt (構成的な正直)。 */
export function buildDockPreview(m: DockMaterial): string {
  const lines: string[] = [];
  lines.push("【届いた提案】");
  lines.push(`宛先: ${m.card.to}`);
  lines.push(m.card.line1);
  if (m.card.line2 !== "") lines.push(m.card.line2);
  if (m.card.line3 !== "") lines.push(m.card.line3);
  if (m.basis !== null) {
    lines.push("【根拠（相手の公開項目）】");
    lines.push(m.basis.title.trim() !== "" ? `${m.basis.title} — ${m.basis.text}` : m.basis.text);
  }
  if (m.partnerIntro.trim() !== "") {
    lines.push("【相手のひとこと紹介】");
    lines.push(m.partnerIntro.trim());
  }
  if (m.selfItems.length > 0) {
    lines.push("【あなた（読み手）の記憶】");
    for (const it of m.selfItems) {
      lines.push(`- ${it.kind}: ${it.title.trim() !== "" ? `${it.title} — ${it.text}` : it.text}`);
    }
  }
  return lines.join("\n");
}

/** instructions + preview — the preview IS the payload (nothing rides unseen). */
export function buildDockPrompt(preview: string): string {
  return `${DOCK_INSTRUCTIONS}\n\n${preview}`;
}
