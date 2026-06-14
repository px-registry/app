// R1.5 meet memory — cold-start intake (rig-intake lineage: fail-closed, never
// throws, warnings carry no raw content).
//
// A tester pastes their everyday LLM's output. The v2 正本 asks the LLM for
// 札ブロック (cards) — blank-line-separated, 1枚＝3行 (「種類 タイトル」/本文/
// 任意のタグ行). That is the primary format. The OLD JSON shapes are still
// accepted silently (互換・告知しない) so testers mid-flight never break:
//   - a bare JSON array of items
//   - the same array inside a ```fenced``` block or surrounded by prose
//   - { "items": [...] } or the facilitator shape [{ ownerId, items }] (first
//     owner's items are taken)
// We try JSON first; only when no JSON item-structure is present do we read the
// paste as cards. 1枚ずつ fail-closed: an unreadable card is dropped with a
// warning while the rest survive (正直な一枚落ち).
//
// Item normalization mirrors lib/rig/rig-intake.ts parseItem semantics:
// kind/text essential (else dropped with a warning); title defaults to "";
// tags keep only string entries; `private` is TRUE unless exactly false.
// The owner then reviews each item (and its 公開/非公開) BEFORE anything is
// stored — intake output is a proposal to the owner, not a write.

import { RIG_MEMORY_KINDS, type RigMemoryItemV1, type RigMemoryKindV1 } from "../rig/rig.ts";

export type MeetIntakeResult = {
  items: RigMemoryItemV1[];
  warnings: string[];
};

const KIND_SET = new Set<string>(RIG_MEMORY_KINDS);

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function parseItem(raw: unknown): RigMemoryItemV1 | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.kind !== "string" || !KIND_SET.has(raw.kind)) return null;
  if (typeof raw.text !== "string" || raw.text.trim() === "") return null;
  const title = typeof raw.title === "string" ? raw.title : "";
  const tags = Array.isArray(raw.tags)
    ? raw.tags.filter((t): t is string => typeof t === "string")
    : [];
  // Fail-closed: only an explicit boolean false makes an item public.
  const priv = raw.private === false ? false : true;
  return { kind: raw.kind as RigMemoryKindV1, title, text: raw.text, tags, private: priv };
}

/** Find the first parseable JSON array/object in a paste that may carry prose
 *  or code fences around it. Returns null when nothing parses. */
function extractJson(paste: string): unknown {
  const stripped = paste.replace(/```[a-zA-Z]*\n?/g, "").replace(/```/g, "");
  // 1. the whole thing
  try {
    return JSON.parse(stripped.trim());
  } catch {
    /* fall through */
  }
  // 2. first [ ... last ] (the common "prose + array + prose" paste)
  const a = stripped.indexOf("[");
  const b = stripped.lastIndexOf("]");
  if (a >= 0 && b > a) {
    try {
      return JSON.parse(stripped.slice(a, b + 1));
    } catch {
      /* fall through */
    }
  }
  // 3. first { ... last } (an { items: [...] } wrapper)
  const c = stripped.indexOf("{");
  const d = stripped.lastIndexOf("}");
  if (c >= 0 && d > c) {
    try {
      return JSON.parse(stripped.slice(c, d + 1));
    } catch {
      /* fall through */
    }
  }
  return null;
}

/** Normalize the accepted top-level shapes down to a raw item array. */
function itemArrayOf(parsed: unknown, warnings: string[]): unknown[] | null {
  if (Array.isArray(parsed)) {
    // facilitator shape? [{ ownerId, items: [...] }, ...] → take the first owner
    if (parsed.length > 0 && isRecord(parsed[0]) && Array.isArray(parsed[0].items)) {
      if (parsed.length > 1) warnings.push("複数人ぶんが見つかったため、最初のひとり分だけ読み込みました。");
      return parsed[0].items;
    }
    return parsed;
  }
  if (isRecord(parsed) && Array.isArray(parsed.items)) return parsed.items;
  return null;
}

/** JSON path (kept for compatibility — accepted silently, never announced).
 *  Returns null when the paste carries no JSON item-structure, so the caller
 *  falls through to the card-block parser. */
function tryJsonItems(paste: string): MeetIntakeResult | null {
  const parsed = extractJson(paste);
  if (parsed === null) return null;
  const warnings: string[] = [];
  const rawItems = itemArrayOf(parsed, warnings);
  if (rawItems === null) return null;
  const items: RigMemoryItemV1[] = [];
  rawItems.forEach((raw, i) => {
    const item = parseItem(raw);
    if (item === null) {
      warnings.push(`${i + 1}番目の項目は読み取れなかったため除外しました。`);
      return;
    }
    items.push(item);
  });
  if (items.length === 0 && warnings.length === 0) {
    warnings.push("読み取れる項目がありませんでした。");
  }
  return { items, warnings };
}

/** Parse one 札ブロック into an item, fail-closed.
 *  Line 1「種類 タイトル」(先頭語=種類), line 2 本文 (required), line 3 以降
 *  タグ＋任意の「非公開」. avoid/memory は非公開既定; have/want は「非公開」明記で
 *  のみ非公開。Returns null when the block is not a readable card. */
function parseCard(block: string): RigMemoryItemV1 | null {
  const lines = block
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l !== "");
  if (lines.length < 2) return null; // 種類行 + 本文 が最低条件
  const head = lines[0];
  const sp = head.search(/\s/);
  const kindWord = (sp === -1 ? head : head.slice(0, sp)).toLowerCase();
  if (!KIND_SET.has(kindWord)) return null;
  const kind = kindWord as RigMemoryKindV1;
  const title = sp === -1 ? "" : head.slice(sp + 1).trim();
  const text = lines[1];
  if (text === "") return null;
  const tagTokens = lines
    .slice(2)
    .join(" ")
    .split(/\s+/)
    .filter((t) => t !== "");
  const tags = tagTokens.filter((t) => t !== "非公開");
  const forcedPrivate = tagTokens.includes("非公開");
  // Fail-closed default: avoid/memory ride 非公開; have/want public unless 非公開.
  const priv = forcedPrivate || kind === "avoid" || kind === "memory";
  return { kind, title, text, tags, private: priv };
}

/** v2 札ブロック parser: blocks separated by a blank line, each 1枚ずつ validated. */
function parseCardBlocks(paste: string): MeetIntakeResult {
  const warnings: string[] = [];
  const items: RigMemoryItemV1[] = [];
  // \r\n を正規化し、念のためコードフェンスを剥がす（v2 は不要と言うが LLM 差を吸収）。
  const cleaned = paste
    .replace(/\r\n?/g, "\n")
    .replace(/```[a-zA-Z]*\n?/g, "")
    .replace(/```/g, "");
  const blocks = cleaned
    .split(/\n[ \t　]*\n/)
    .map((b) => b.trim())
    .filter((b) => b !== "");
  blocks.forEach((block, i) => {
    const card = parseCard(block);
    if (card === null) {
      warnings.push(`${i + 1}枚目のカードは読み取れなかったため除外しました。`);
      return;
    }
    items.push(card);
  });
  if (items.length === 0 && warnings.length === 0) {
    warnings.push("カードが見つかりませんでした。AIの出力をそのまま貼ってください。");
  }
  return { items, warnings };
}

/**
 * Parse a pasted cold-start output into reviewed-before-stored items.
 * NEVER throws; whatever does not parse is reported as a warning (no raw
 * content in warnings) and skipped. v2 札ブロックが主形式、旧 JSON は黙って受ける。
 */
export function parseColdStartPaste(paste: string): MeetIntakeResult {
  if (paste.trim() === "") {
    return { items: [], warnings: ["まだ何も貼られていません。"] };
  }
  // 旧 JSON 形式は黙って受け続ける（互換・告知しない）— まず JSON として読めるか。
  const json = tryJsonItems(paste);
  if (json !== null) return json;
  // v2 札ブロック形式。
  return parseCardBlocks(paste);
}
