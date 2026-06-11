// c11 — anchor の宛先反転（案C）。
//
// anchor は「話してみる」を押した提案カードの line1 由来。rule 9 は提案を
// 読み手=送り手に宛てて書かせるので、line1 の「あなた」は SENDER を指す。
// それを受け手画面に verbatim で出すと主語が反転する（受け手が「あなたの納屋」
// と、相手の納屋を自分の物として読まされる）。
//
// 原則: 加工は自分の文を・自分の側で・相手に渡す前に。送り手クライアントが
// 自分の line1 を受け手宛てに組み替えてから送る。受け手は届いた文字列を
// verbatim 表示（M-10 不変）。サーバ無変更（anchor は従来どおり一個の文字列）。
//
//   入力（法で厳格な書式）: あなたの X × ［相手名］の Y   （あなた=送り手）
//   出力:                   あなたの Y × ［送り手表示名］の X （あなた=受け手）
//
// 80字制限は組み替え後に適用。パース不能（truncation・書式逸脱・空の片側）は
// fail-close で現行どおり line1 先頭80字を verbatim 送信 — 送信は止めない。
// 既存在庫の旧形式 anchor はマイグレーションせず、受け手側で従来どおり表示。

export const MAX_ANCHOR = 80;

/** One line in the 式 shape (あなたの X × ［to］の Y) → recipient-addressed
 *  swap, or null when the line doesn't parse as the 式. */
function swapLine(line: string, to: string, senderName: string): string | null {
  const lead = "あなたの";
  if (!line.startsWith(lead)) return null;
  // the format block writes 全角 ［相手名］, but real models also emit 半角
  // [相手名] (qwen, observed in smoke) — accept both; the OUTPUT is always
  // the canonical 全角 form.
  for (const marker of [`［${to}］の`, `[${to}]の`]) {
    const m = line.indexOf(marker);
    if (m <= lead.length) continue;
    // between = "X × " (spacing around × may vary; anything else → fallback)
    const xm = line.slice(lead.length, m).match(/^([\s\S]*?)\s*×\s*$/);
    if (xm === null) continue;
    const x = xm[1].trim();
    // a sentence-final 。 would otherwise land mid-anchor after the swap
    const y = line
      .slice(m + marker.length)
      .trim()
      .replace(/。$/, "");
    if (x === "" || y === "") continue;
    return `あなたの${y} × ［${senderName.trim()}］の${x}`.slice(0, MAX_ANCHOR);
  }
  return null;
}

/**
 * c13 — staged search: rule 9 v3 puts the 式 on LINE 2 (line1 is the 言い切り),
 * v2 stock put it on line1. Try line1 → line2 → fall back to the verbatim head
 * of line1 (従来どおり; fail-close never blocks the send).
 */
export function anchorForRecipient(
  line1: string,
  line2: string,
  to: string,
  senderName: string,
): string {
  if (senderName.trim() !== "") {
    for (const line of [line1, line2]) {
      const swapped = swapLine(line, to, senderName);
      if (swapped !== null) return swapped;
    }
  }
  return line1.slice(0, MAX_ANCHOR);
}
