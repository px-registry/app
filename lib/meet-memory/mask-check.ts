// 補遺 E — 伏せたい言葉の構造チェック (deterministic; provenance-gate 同思想).
// Model-side masking is best-effort and was OBSERVED to leak ("Protocol X",
// "PX" survived a 伏せ版 draft). What actually protects the owner is this
// check: the OUTGOING text (the public view — never the private body, which
// doesn't leave) is scanned for the owner's listed words, case- and
// width-insensitively. A hit warns; it never blocks — the owner keeps the
// freedom to send a word out deliberately.

/** NFKC folds full/half width (ＰＸ→PX, ｱ→ア); lowercase folds case. */
export function normalizeMaskText(s: string): string {
  return s.normalize("NFKC").toLowerCase();
}

/** Free-text list input → words (、 , ／ / and newlines separate). */
export function parseMaskWords(input: string): string[] {
  const out: string[] = [];
  for (const raw of input.split(/[、,，／/\n]/)) {
    const w = raw.trim();
    if (w !== "" && !out.includes(w)) out.push(w);
  }
  return out;
}

/**
 * Which listed words survive in an outgoing title/text pair? Returns the
 * words AS THE OWNER WROTE THEM (for the warning line), first-hit order.
 */
export function findMaskLeaks(words: string[], title: string, text: string): string[] {
  const hay = normalizeMaskText(`${title}\n${text}`);
  const out: string[] = [];
  for (const word of words) {
    const needle = normalizeMaskText(word.trim());
    if (needle !== "" && hay.includes(needle) && !out.includes(word)) out.push(word);
  }
  return out;
}
