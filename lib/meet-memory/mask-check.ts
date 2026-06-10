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

// ── 第4便 B — 検出→タップ適用 (the inversion: AI offers, the owner decides) ────

/** One offered replacement: the detected word and its 伏せ語 suggestion. */
export type MaskPair = { word: string; mask: string };

/** 未接続 or no suggestion — the plain default mask. */
export const DEFAULT_MASK = "●●";

/**
 * Deterministic backstop on the DETECTION side: a pair survives only when its
 * word actually occurs in the outgoing text (case/width-folded). A model can
 * point only at what is really there — a hallucinated detection dies here.
 */
export function filterDetections(pairs: MaskPair[], title: string, text: string): MaskPair[] {
  const hay = normalizeMaskText(`${title}\n${text}`);
  const out: MaskPair[] = [];
  const seen = new Set<string>();
  for (const p of pairs) {
    const needle = normalizeMaskText(p.word.trim());
    if (needle === "" || !hay.includes(needle) || seen.has(needle)) continue;
    seen.add(needle);
    out.push({ word: p.word.trim(), mask: p.mask.trim() });
  }
  return out;
}

/** Replace every case/width-folded occurrence of `word` with `mask`. */
function replaceNormalized(haystack: string, word: string, mask: string): string {
  const needle = normalizeMaskText(word.trim());
  if (needle === "") return haystack;
  let out = "";
  let i = 0;
  while (i < haystack.length) {
    // try to consume haystack chars matching the folded needle from position i
    let hi = i;
    let ni = 0;
    while (hi < haystack.length && ni < needle.length) {
      const folded = normalizeMaskText(haystack[hi]);
      if (folded.length > 0 && needle.startsWith(folded, ni)) {
        ni += folded.length;
        hi++;
      } else break;
    }
    if (ni === needle.length && hi > i) {
      out += mask;
      i = hi;
    } else {
      out += haystack[i];
      i++;
    }
  }
  return out;
}

/**
 * Apply chosen replacements to an OUTGOING title/text pair. Pure — the caller
 * writes the result into publicTitle/publicText; the private body is never
 * touched. An empty mask falls back to the plain DEFAULT_MASK.
 */
export function applyMasks(
  title: string,
  text: string,
  pairs: MaskPair[],
): { title: string; text: string } {
  let t = title;
  let x = text;
  for (const p of pairs) {
    const mask = p.mask.trim() !== "" ? p.mask.trim() : DEFAULT_MASK;
    t = replaceNormalized(t, p.word, mask);
    x = replaceNormalized(x, p.word, mask);
  }
  return { title: t, text: x };
}

/** Grow the byproduct list — dedupe by folded form, owner's spelling kept. */
export function mergeMaskWords(existing: string[], added: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const w of [...existing, ...added]) {
    const k = normalizeMaskText(w.trim());
    if (k === "" || seen.has(k)) continue;
    seen.add(k);
    out.push(w.trim());
  }
  return out;
}
