// R2 GOAL — Dock L3: 操作の下書き（候補化・ノート・渡す文面。第一信は c17 既済）。
//
// firstnote.ts と同じ文法: 指示部 verbatim ＋ 材料ブロック（無い材料は見出しごと
// 省く — 空見出しはモデルが発明で埋める）。呼び出しは generate.ts 経由の
// browser 直 — PX はモデルを実行しない。返事は下書き — 欄に入るだけで、
// 実行（投函・公開）は常に owner の既存確認動線。
//
// 材料の階級（preview 不要の設計）: この三具の材料は、いま owner の画面に見えて
// いるもの（接点の行・basis・呼び名・その項目の本文）だけ。SELF 記憶の同梱は
// しない — private が乗らないので、プレビューは画面そのものが担う（Dock L2 の
// 検索だけが SELF を運び、あちらはプロンプト全文プレビューを持つ）。

// ── ノート（spec §10 接点メモ三機能: 会話準備・境界のブレーキ・わからないの橋）──

export const NOTE_DRAFT_PROMPT = [
  "あなたは、ownerがトークルームに立てるノートを下書きする取次です。",
  "ノートは一枚の立て札で、相手と、相手のAIが読みます。",
  "材料: 接点（提案の行）、相手の公開項目、ownerの呼び名（あれば）。",
  "書き方:",
  "- 会話の準備を助ける: いま話したい範囲と、最初の話題を短く。",
  "- 境界があれば一言（例:「価格の話はまだ」）。無ければ書かない。",
  "- わからないことは「わからない」と正直に書いてよい。",
  "- 全体で2〜4文。敬体。約束・価格・相手の品定めは書かない。",
  "- 出力は本文のみ。前置き・説明・引用符を付けない。",
].join("\n");

export type NoteDraftMaterial = {
  /** 接点（提案の行・または anchor 一行）。 */
  lines: string[];
  /** 相手の公開項目（無ければ null — 見出しごと省く）。 */
  basis: { title: string; text: string } | null;
  ownerName: string;
};

export function buildNoteDraftPrompt(m: NoteDraftMaterial): string {
  const parts = [NOTE_DRAFT_PROMPT, "", "【材料】"];
  if (m.lines.length > 0) {
    parts.push("接点:");
    for (const line of m.lines) parts.push(`- ${line}`);
  }
  if (m.basis !== null) {
    const b = m.basis.title.trim() !== "" ? `${m.basis.title} — ${m.basis.text}` : m.basis.text;
    parts.push(`相手の公開項目: ${b}`);
  }
  if (m.ownerName.trim() !== "") parts.push(`ownerの呼び名: ${m.ownerName.trim()}`);
  return parts.join("\n");
}

// ── 渡す文面（連絡メモ）— 連絡先は発明できない: 必ず差し込み印を置く ────────────

/** 下書きに必ず立つ差し込み印 — owner がここに実物を入れる（AI は知らない）。 */
export const CONTACT_PLACEHOLDER = "«ここに連絡先»";

export const CONTACT_DRAFT_PROMPT = [
  "あなたは、ownerが相手に渡す連絡メモ（連絡のつき方）を下書きする取次です。",
  "あなたは owner の連絡先を知りません。発明せず、具体の宛先の位置に必ず",
  `${CONTACT_PLACEHOLDER} と書きます。`,
  "書き方:",
  "- 1〜2文＋宛先。例: 「メールが早いです。" + CONTACT_PLACEHOLDER + "」",
  "- 敬体。約束・条件・営業時間のような不確かな事実は書かない。",
  "- 出力は本文のみ。前置き・説明・引用符を付けない。",
].join("\n");

export function buildContactDraftPrompt(m: { peerName: string; ownerName: string }): string {
  const parts = [CONTACT_DRAFT_PROMPT, "", "【材料】"];
  if (m.peerName.trim() !== "") parts.push(`相手の呼び名: ${m.peerName.trim()}`);
  if (m.ownerName.trim() !== "") parts.push(`ownerの呼び名: ${m.ownerName.trim()}`);
  return parts.join("\n");
}

/** fail-closed: 差し込み印の無い渡す文面は採らない（発明された連絡先を疑う）。 */
export function contactDraftKeepsPlaceholder(text: string): boolean {
  return text.includes(CONTACT_PLACEHOLDER);
}

// ── 候補化（公開の書き方）— c14 同原理: 他人に読める形へ、取り出すその場で一度 ──

export const PUBLIC_PHRASING_PROMPT = [
  "あなたは、ownerの記憶の一枚を、公開候補に出すときの書き方に直す取次です。",
  "読むのは owner を知らない人とそのAIです。",
  "書き方:",
  "- 初めて読む人に伝わる言い回しにする。内輪の符号・固有名・社名は伏せるか一般語に直す。",
  "- 新しい事実を足さない。中身は変えず、言い回しだけ直す。",
  '- 出力は次の JSON のみ: { "title": "一言タイトル（16字まで）", "text": "本文（1〜2行）" }',
].join("\n");

export function buildPublicPhrasingPrompt(item: { title: string; text: string }): string {
  const parts = [PUBLIC_PHRASING_PROMPT, "", "【材料】"];
  if (item.title.trim() !== "") parts.push(`タイトル: ${item.title}`);
  parts.push(`本文: ${item.text}`);
  return parts.join("\n");
}

/** fail-closed parse — JSON 以外・空文字は null（正直な一行へ）。 */
export function parsePublicPhrasingReply(raw: string): { title: string; text: string } | null {
  const stripped = raw.replace(/```[a-zA-Z]*\n?/g, "").replace(/```/g, "").trim();
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(stripped);
  } catch {
    const a = stripped.indexOf("{");
    const b = stripped.lastIndexOf("}");
    if (a >= 0 && b > a) {
      try {
        parsed = JSON.parse(stripped.slice(a, b + 1));
      } catch {
        return null;
      }
    }
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
  const o = parsed as Record<string, unknown>;
  if (typeof o.title !== "string" || typeof o.text !== "string") return null;
  const title = o.title.trim().slice(0, 16);
  const text = o.text.trim();
  if (text === "") return null;
  return { title, text };
}
