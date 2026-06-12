// R1.5 meet memory — cold-start intake (rig-intake lineage: fail-closed, never
// throws, warnings carry no raw content).
//
// A tester pastes their everyday LLM's output. We accept, leniently:
//   - a bare JSON array of items
//   - the same array inside a ```fenced``` block or surrounded by prose
//   - { "items": [...] } or the facilitator shape [{ ownerId, items }] (first
//     owner's items are taken)
// Per the goal, the real samples this five-person test produces become the
// parser spec — a line-format parser is deliberately deferred until then.
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

/**
 * Parse a pasted cold-start output into reviewed-before-stored items.
 * NEVER throws; whatever does not parse is reported as a warning (no raw
 * content in warnings) and skipped.
 */
export function parseColdStartPaste(paste: string): MeetIntakeResult {
  const warnings: string[] = [];
  if (paste.trim() === "") {
    return { items: [], warnings: ["まだ何も貼られていません。"] };
  }
  const parsed = extractJson(paste);
  if (parsed === null) {
    return {
      items: [],
      warnings: ["JSONが見つかりませんでした。AIの出力をそのまま貼ってください。"],
    };
  }
  const rawItems = itemArrayOf(parsed, warnings);
  if (rawItems === null) {
    return { items: [], warnings: ["項目の並びが見つかりませんでした。"] };
  }
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
