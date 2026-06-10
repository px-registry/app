// PORTED from px-table — design original / law original / lab original.
//   Source: px-table repo, lib/px-work/rig-intake.ts @ main f46f470 (R1: PR #34, #35).
//   This copy is the LIVING implementation for the R1.5 five-person deploy; the
//   px-table file stays the design/law original and is NOT tracked from here.
//   Pinned by lib/rig/rig-gates.test.ts (see rig.ts header for the full list).
// PX Work — R1 rig intake (Atomic 2). Pure, session-only, no I/O.
//
// The debug harness (app/rig) takes a facilitator-pasted JSON blob, parses it
// FAIL-CLOSED into RigOwnerV1[], mints session-local ownerRef pseudonyms, and
// flags (non-blocking) when a pasted LLM output appears to echo an owner's raw
// private/avoid text. None of this runs a model or persists anything — it only
// prepares input for the Atomic-1 core (buildPublicPool / buildOwnerPrompt).
//
// The cold-start LINE-format parser is intentionally NOT here: until a canonical
// cold-start sample is fixed, JSON intake keeps the format from being de-facto
// frozen by a parser (deferred to a later atomic).

import {
  RIG_MEMORY_KINDS,
  type RigMemoryItemV1,
  type RigMemoryKindV1,
  type RigOwnerV1,
} from "./rig.ts";

// ── Intake parse (fail-closed) ─────────────────────────────────────────────────

export type RigIntakeResultV1 = {
  /** Only the owners/items that parsed cleanly. */
  owners: RigOwnerV1[];
  /** Non-blocking notes about what was dropped/normalized (never raw content). */
  warnings: string[];
};

const KIND_SET = new Set<string>(RIG_MEMORY_KINDS);

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

// Normalize one raw item. Returns null when an ESSENTIAL field (kind/text) is
// broken — that item is dropped. Non-essential fields get safe defaults:
//   - title: "" when not a string
//   - tags : verbatim string entries when an array, else []
//   - private: TRUE unless exactly `false` (missing/undefined never => public)
function parseItem(raw: unknown): RigMemoryItemV1 | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.kind !== "string" || !KIND_SET.has(raw.kind)) return null;
  if (typeof raw.text !== "string") return null;
  const title = typeof raw.title === "string" ? raw.title : "";
  const tags = Array.isArray(raw.tags)
    ? raw.tags.filter((t): t is string => typeof t === "string")
    : [];
  // Fail-closed: only an explicit boolean false makes an item public.
  const priv = raw.private === false ? false : true;
  return { kind: raw.kind as RigMemoryKindV1, title, text: raw.text, tags, private: priv };
}

/**
 * Parse a facilitator-pasted JSON blob into clean owners. NEVER throws: a JSON
 * syntax error, a non-array top level, an owner without a usable ownerId, a
 * duplicate ownerId, or a non-array `items` are each reported as a warning and the
 * offending part is skipped. The returned owners are fully typed so the Atomic-1
 * core receives well-formed input.
 */
export function parseRigOwners(json: string): RigIntakeResultV1 {
  const warnings: string[] = [];
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return { owners: [], warnings: ["JSON を読み取れませんでした。"] };
  }
  if (!Array.isArray(raw)) {
    return { owners: [], warnings: ["トップレベルは owner の配列である必要があります。"] };
  }

  const owners: RigOwnerV1[] = [];
  const seen = new Set<string>();
  raw.forEach((entry, i) => {
    if (!isRecord(entry) || typeof entry.ownerId !== "string" || entry.ownerId.trim() === "") {
      warnings.push(`owner[${i}] は ownerId が無いため除外しました。`);
      return;
    }
    const ownerId = entry.ownerId.trim();
    if (seen.has(ownerId)) {
      warnings.push(`owner「${ownerId}」は ownerId が重複のため除外しました。`);
      return;
    }
    if (!Array.isArray(entry.items)) {
      warnings.push(`owner「${ownerId}」は items が配列でないため除外しました。`);
      return;
    }
    const items: RigMemoryItemV1[] = [];
    entry.items.forEach((it, j) => {
      const parsed = parseItem(it);
      if (parsed === null) {
        warnings.push(`owner「${ownerId}」item[${j}] は必須項目が壊れているため除外しました。`);
        return;
      }
      items.push(parsed);
    });
    seen.add(ownerId);
    owners.push({ ownerId, items });
  });

  return { owners, warnings };
}

// ── ownerRef minting (deterministic, session-local) ────────────────────────────

const ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/**
 * Map each owner to a session-local public-safe pseudonym by INTAKE ORDER:
 * 参加者A, 参加者B, …, 参加者Z, then 参加者27, 参加者28, … as a fallback past 26.
 * Deterministic; the raw ownerId is never used as the public identifier. The pure
 * core only ENFORCES the mapping (buildPublicPool); minting lives here in the UI lane.
 */
export function assignOwnerRefs(owners: RigOwnerV1[]): ReadonlyMap<string, string> {
  const map = new Map<string, string>();
  owners.forEach((owner, i) => {
    const ref = i < ALPHA.length ? `参加者${ALPHA[i]}` : `参加者${i + 1}`;
    map.set(owner.ownerId, ref);
  });
  return map;
}

/**
 * The default `参加者A…` ref per owner, with optional facilitator nickname
 * overrides applied. A blank/whitespace override falls back to the default
 * (fail-closed: an ownerRef is never empty, so an owner is never dropped for a
 * blank nickname), and the raw ownerId is still never used as the public ref.
 */
export function effectiveOwnerRefs(
  owners: RigOwnerV1[],
  overrides: Record<string, string>,
): ReadonlyMap<string, string> {
  const map = new Map(assignOwnerRefs(owners));
  for (const owner of owners) {
    const nick = overrides[owner.ownerId];
    if (typeof nick === "string" && nick.trim().length > 0) {
      map.set(owner.ownerId, nick.trim());
    }
  }
  return map;
}

// ── Private-echo warning (non-blocking, facilitator aid) ───────────────────────

/** Fixed note shown when a pasted output may echo private memory. No raw text. */
export const RIG_PRIVATE_ECHO_NOTE =
  "非公開の記憶がそのまま含まれている可能性があります。必要なら貼り戻し前に伏せてください。";

/**
 * True when the owner's PRIVATE (or avoid) raw text/title appears as an exact
 * substring of the pasted LLM output. This is only a visual aid for the
 * facilitator — it is non-blocking, makes no judgement that "the law was broken",
 * produces no score/count, and NEVER returns or reveals the matched text itself.
 */
export function pastedOutputEchoesPrivate(
  self: RigOwnerV1,
  pastedOutput: string,
): boolean {
  if (pastedOutput.trim().length === 0) return false;
  for (const item of self.items) {
    const sensitive = item.private === true || item.kind === "avoid";
    if (!sensitive) continue;
    for (const needle of [item.text, item.title]) {
      const n = needle.trim();
      if (n.length > 0 && pastedOutput.includes(n)) return true;
    }
  }
  return false;
}

// ── Sample JSON (debug aid; shown in the harness) ──────────────────────────────

export const RIG_SAMPLE_JSON = `[
  {
    "ownerId": "owner-1",
    "items": [
      { "kind": "have", "title": "活版印刷の工房", "text": "古い手キンで小ロット印刷ができる", "tags": ["手仕事", "ものづくり"], "private": false },
      { "kind": "want", "title": "子どもと作る場", "text": "親子で手を動かす時間をつくりたい", "tags": ["親子"], "private": false },
      { "kind": "memory", "title": "原点", "text": "祖父の印刷所で育った", "tags": [], "private": true }
    ]
  },
  {
    "ownerId": "owner-2",
    "items": [
      { "kind": "have", "title": "昼だけのカフェ", "text": "平日昼に間借りで開けている", "tags": ["飲食"], "private": false },
      { "kind": "want", "title": "夜の使い手", "text": "夜の時間に店を活かしたい", "tags": ["場所", "夜"], "private": false },
      { "kind": "avoid", "title": "苦手", "text": "大人数のうるさい貸切は避けたい", "tags": [], "private": true }
    ]
  }
]`;
