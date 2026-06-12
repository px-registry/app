// R1.5 c17 — 第一信の下書き（Handoff Lite）。
//
// mutual 後の「この接点で話す」面: owner の AI が第一信を下書きし、owner が
// 自分の言葉に直してコピーする。呼び出しは generate.ts（このレーン唯一の
// fetch ファイル）経由で owner のモデル・owner の鍵 — PX はモデルを実行しない。
// 結果は端末の firstnote レーン（lib/meet-memory）にだけ残る。
//
// 材料の出どころ（firstNoteMaterialFor）:
//   起点側 — この端末の received 棚に、この相手宛ての gate 通過カードがある
//            → 提案3行＋basis 1件（表示と同じ provenance gate を通す）
//   応答側 — カードが無い → 届いた anchor（受け手宛てに組み替え済みの接点）
// どちらも無ければ材料は呼び名/ひとこと紹介だけに痩せる（あれば、の設計）。

import type { ProposalCard } from "./prompt.ts";
import { gateCardsByProvenance } from "./provenance.ts";

/** c17 指示書 §2 — verbatim・pin固定（meet-ai gates が一字一句を見る）。 */
export const FIRST_NOTE_PROMPT = [
  "あなたは、ownerの最初のひとことを下書きする取次です。",
  "材料: 提案の3行（接点）、相手の公開項目、ownerの呼び名とひとこと紹介（あれば）。",
  "書き方:",
  "- 届いた接点から始める。自己紹介や挨拶の定型から始めない。",
  "- 1文目: どの接点の話かを自分の言葉で言う（「PXで『◯◯ × ◯◯』という接点が届きました」の形でよい）。",
  "- 2文目: なぜ気になったかを一言。",
  "- 3文目: 相手の公開項目について一つだけ聞く。または、15分で試せる小さな一歩を一つ提案する。",
  "- 全体で2〜4文。敬体。約束・価格・大きな計画は書かない。決めすぎない。",
  "- 出力は本文のみ。前置き・説明・引用符を付けない。",
].join("\n");

export type FirstNoteMaterial = {
  /** 提案の3行（接点）— gate 通過カードの行、または応答側は anchor 一行。 */
  lines: string[];
  /** 相手の公開項目 — カードの basis 1件（無ければ null・面にも出ない）。 */
  basis: { title: string; text: string } | null;
  /** owner の呼び名（あれば）。 */
  ownerName: string;
  /** owner のひとこと紹介（あれば）。 */
  ownerIntro: string;
};

/** Entry shape this module needs from the received shelf (structural — the
 *  shelf type itself lives in lib/meet-memory and must not be imported here). */
export type FirstNoteEntryLike = {
  cards: ProposalCard[];
  refs: Record<string, string>;
  basisItems?: Record<string, { ownerRef: string; title: string; text: string }>;
};

/**
 * 材料の探索: entries は新しい順（received 棚の表示順のまま）。この相手宛ての
 * gate 通過カードの最初の一枚が勝つ。無ければ anchor 一行に退く（fail-close:
 * 材料が薄くても面は開く — L0 の手書きは常に生きている）。
 */
export function firstNoteMaterialFor(
  peerRef: string,
  entries: FirstNoteEntryLike[],
  anchor: string,
): Pick<FirstNoteMaterial, "lines" | "basis"> {
  for (const entry of entries) {
    const { kept } = gateCardsByProvenance(entry.cards, entry.refs, entry.basisItems);
    for (const { card } of kept) {
      if (entry.refs[card.to] !== peerRef) continue;
      const lines = [card.line1, card.line2, card.line3].filter((l) => l.trim() !== "");
      const b = entry.basisItems?.[card.basisItemId];
      return { lines, basis: b === undefined ? null : { title: b.title, text: b.text } };
    }
  }
  const a = anchor.trim();
  return { lines: a === "" ? [] : [a], basis: null };
}

/**
 * Prompt assembly — the pinned instruction verbatim at the head, then a 材料
 * block in the instruction's own vocabulary. Absent materials are OMITTED
 * (never an empty heading the model would fill by inventing).
 */
export function buildFirstNotePrompt(m: FirstNoteMaterial): string {
  const parts = [FIRST_NOTE_PROMPT, "", "【材料】"];
  if (m.lines.length > 0) {
    parts.push("接点:");
    for (const line of m.lines) parts.push(`- ${line}`);
  }
  if (m.basis !== null) {
    const b = m.basis.title.trim() !== "" ? `${m.basis.title} — ${m.basis.text}` : m.basis.text;
    parts.push(`相手の公開項目: ${b}`);
  }
  if (m.ownerName.trim() !== "") parts.push(`ownerの呼び名: ${m.ownerName.trim()}`);
  if (m.ownerIntro.trim() !== "") parts.push(`ownerのひとこと紹介: ${m.ownerIntro.trim()}`);
  return parts.join("\n");
}

/**
 * Fail-closed parse: the contract is 本文のみ, so the reply IS the draft.
 * Lenient about the two observed weak-model tics only — code fences and one
 * wrapping quote pair. Empty after that → null (正直なエラー一行＋再試行).
 */
export function parseFirstNoteReply(raw: string): string | null {
  let s = raw.replace(/```[a-zA-Z]*\n?/g, "").replace(/```/g, "").trim();
  for (const [open, close] of [
    ["「", "」"],
    ["『", "』"],
    ['"', '"'],
  ] as const) {
    if (s.startsWith(open) && s.endsWith(close) && s.length > open.length + close.length) {
      s = s.slice(open.length, s.length - close.length).trim();
      break;
    }
  }
  return s === "" ? null : s;
}
