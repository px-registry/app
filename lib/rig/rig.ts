// PORTED from px-table — design original / law original / lab original.
//   Source: px-table repo, lib/px-work/rig.ts @ main f46f470 (R1: PR #34, #35).
//   This copy is the LIVING implementation for the R1.5 five-person deploy; the
//   px-table file stays the design/law original and is NOT tracked from here.
//   The port is pinned by lib/rig/rig-gates.test.ts: source commit, RIG_LAW
//   verbatim (frozen — wording changes are forbidden), buildPublicPool
//   fail-closed boundary, ownerRef-only projection, private-leak negatives,
//   and a no-io scan over lib/rig (no fetch / provider / persistence symbols).
// PX Work — R1 minimal AI rig (paste-back form). Pure, session-only, no I/O.
//
// R1 lets a 5-person test run in the form "the OWNER's own AI proposes to the
// owner". PX does NOT run any model and holds NO memory: this module only
// ASSEMBLES the text an owner pastes into their own everyday LLM, and shapes the
// public candidate pool. There is no provider, no network, no persistence here —
// the owner runs their own model and pastes the result back (see the debug route).
//
// Two strictly separated data channels (the eligibility boundary):
//
//   - SELF channel  : the owner's OWN full memory (private items included) goes
//     ONLY into that owner's own prompt block, for the owner to ground their own
//     model on themselves. It is assembled in-session and never stored, never
//     shown to anyone else.
//   - SHARED channel: the candidate pool carries PUBLIC items only. `buildPublicPool`
//     is fail-closed — an item enters the pool ONLY when `private === false`, so a
//     private item of any owner can never reach another owner's prompt.
//
// Non-ranking: there is no score/rank field on any type here, and nothing is
// sorted by a quality measure. Input order is preserved; the "law" instructs the
// owner's model not to rank, and the paste-back read surface shows output as-is.

// ── Memory shape (intake; session-only) ───────────────────────────────────────
//
// Drafted from the cold-start prompt output: have / want / avoid / memory items,
// each with public tags and a private flag. Field shape is provisional — confirm
// against the (external) cold-start doc before treating it as fixed.
export type RigMemoryKindV1 = "have" | "want" | "avoid" | "memory";

export const RIG_MEMORY_KINDS: readonly RigMemoryKindV1[] = Object.freeze([
  "have",
  "want",
  "avoid",
  "memory",
]);

export type RigMemoryItemV1 = {
  kind: RigMemoryKindV1;
  /** One-line title (cold-start: 一言タイトル). Keeps the anchor concrete in the proposal. */
  title: string;
  /** Free text — allowed in the SELF channel; only `private === false` items reach the pool. */
  text: string;
  /**
   * Public tag identifiers (not a content channel). Carried THROUGH verbatim — the
   * rig does NOT validate or drop wobbly tags at intake; fail-closed lives on the
   * pool's `private` gate, not here.
   */
  tags: string[];
  /** Inclusion in the shared pool requires this to be exactly `false` (fail-closed). */
  private: boolean;
};

export type RigOwnerV1 = {
  ownerId: string;
  items: RigMemoryItemV1[];
};

/**
 * A public item flattened into the shared candidate pool. CONTENT projection is
 * the closed set ownerRef/kind/title/text/tags — no `private`, no score/rank, and
 * (critically) no pass-through of arbitrary memory fields.
 *
 * The participant is identified ONLY by `ownerRef` — a session-local, public-safe
 * pseudonym. The raw `ownerId` (the internal identifier used for self-exclusion)
 * is NEVER projected here, so it cannot reach the shared pool or any prompt.
 */
export type RigPublicPoolItemV1 = {
  ownerRef: string;
  kind: RigMemoryKindV1;
  title: string;
  text: string;
  tags: readonly string[];
};

/** Options for {@link buildPublicPool}. */
export type BuildPublicPoolOptionsV1 = {
  /** Self-exclusion: items from this owner are never pooled (no self-proposal). */
  excludeOwnerId?: string;
  /**
   * Maps internal `ownerId` -> session-local public-safe pseudonym (`ownerRef`).
   * An item whose owner has no usable ref is DROPPED (fail-closed) — a raw ownerId
   * must never substitute for a missing pseudonym. The pure layer only ENFORCES
   * this mapping; how a pseudonym is minted (e.g. 「参加者A」) is an intake-UI
   * concern (Atomic 2), not decided here.
   */
  ownerRefById: ReadonlyMap<string, string>;
};

// ── Shared candidate pool (PUBLIC only; fail-closed) ───────────────────────────
//
// Flatten owners' PUBLIC items into a pool, preserving input order (no sort).
//
// Two fail-closed gates, both deny-by-default:
//   1. private — an item enters ONLY when `private === false`; `true`, `undefined`,
//      missing, or any non-strict-false value is excluded.
//   2. ownerRef — an owner is included ONLY when `ownerRefById` yields a non-empty
//      pseudonym; otherwise every item of that owner is dropped (the raw ownerId is
//      never used as a fallback identifier).
// Self-exclusion (excludeOwnerId) is applied here so the returned items carry no
// ownerId for a caller to have to re-filter on.
//
// HARDENING (PR #34): the returned object is built by EXPLICIT PICK — never object
// spread / item pass-through. A future field added to RigMemoryItemV1 (a raw memory
// body, an internal note) does NOT ride along; it would have to be added here
// deliberately. tags are copied defensively and kept verbatim (no validate/drop —
// fail-closed lives only on the two gates above).
export function buildPublicPool(
  owners: RigOwnerV1[],
  opts: BuildPublicPoolOptionsV1,
): RigPublicPoolItemV1[] {
  const pool: RigPublicPoolItemV1[] = [];
  for (const owner of owners) {
    if (opts.excludeOwnerId !== undefined && owner.ownerId === opts.excludeOwnerId) {
      continue; // self-exclusion (no self-proposal)
    }
    const rawRef = opts.ownerRefById.get(owner.ownerId);
    const ownerRef = typeof rawRef === "string" ? rawRef.trim() : "";
    if (ownerRef.length === 0) continue; // fail-closed: no public-safe ref → drop owner
    for (const item of owner.items) {
      if (item.private === false) {
        pool.push({
          ownerRef,
          kind: item.kind,
          title: item.title,
          text: item.text,
          tags: [...item.tags],
        });
      }
    }
  }
  return pool;
}

// ── The law of encounter (embedded verbatim in the prompt) ─────────────────────
//
// These are instructions to the OWNER's own model, not PX behaviour. The
// non-ranking rules ("並べない" / "順位の意味を持たせない") keep the output
// unordered, and the private-handling rule keeps the owner's raw private/avoid out
// of the proposal body even though the SELF block grounds the model on it.
export type RigLawV1 = {
  readonly rules: readonly string[];
  readonly output: string;
};

export const RIG_LAW: RigLawV1 = Object.freeze({
  rules: Object.freeze([
    "両得 ＋ 一人では届かないC（owner の願いも叶う。与えるだけ＝出さない）。",
    "同ジャンルの似た者同士に留まらず、異ジャンルの相補をよく読む。ただし候補に点数・順位・優劣はつけない。",
    "owner の avoid を跨ぐなら出さない。",
    "スコア・順位・評価をつけない・並べない。中身だけ読む。",
    "出す順番に順位の意味を持たせない。",
    "owner の private / avoid は判断にだけ使い、本文として引用・再掲しない。",
    "良いのが無ければ「今日は無い」。何でも出さない。",
    "相手は実在として断定しない（擬似・実マッチでない）。",
    // rule 9 — 改訂（2026-06-10 Hiroto 裁定: 実テスト初フィードバック→GPT
    // adversarial 一巡→裁定確定文。この文面で固定）。
    "提案は読み手に宛てて書く。読み手は「あなた」、相手は表示名で呼ぶ。「私」は使わない。複数の相手を一枚に混ぜない。\n各提案は2行：\n1行目：あなたの○○ × ［相手名］の○○。重なりを一つだけ。双方の専門語・内輪の言い回し・private/avoid の原文は引用せず、平易に言い換える。足さない。\n2行目：そこから生まれそうなものを一つ、具体に言い切る。\n各提案に、根拠にした相手の公開項目を一つ示す（basisItemId）。示せない提案は出さない。\n「話してみる」とは書かない。締めの誘導文・依頼文・連絡を促す文も書かない（ボタンが担う）。",
  ]) as readonly string[],
  output: "出力：3〜5枚。少なくてよい。良いものが無ければ「今日は無い」。",
});

// ── Prompt assembly (paste-back) ───────────────────────────────────────────────

const BLOCK_SELF = "【あなたの記憶（あなた自身のための grounding・公開しません）】";
const BLOCK_POOL = "【公開候補プール（他の参加者が公開した項目のみ）】";
const BLOCK_LAW = "【出会いの法】";
const POOL_EMPTY = "（今日の公開候補はありません）";

// cold-start card = 一言タイトル ＋ 本文1〜2行. Render "title — text" so the anchor
// stays concrete; if a title is empty, fall back to text alone.
function body(title: string, text: string): string {
  return title.trim().length > 0 ? `${title} — ${text}` : text;
}

function selfLine(item: RigMemoryItemV1): string {
  const tags = item.tags.length > 0 ? `（tags: ${item.tags.join(" / ")}）` : "";
  return `- ${item.kind}: ${body(item.title, item.text)}${tags}`;
}

function poolLine(item: RigPublicPoolItemV1): string {
  const tags = item.tags.length > 0 ? `（tags: ${item.tags.join(" / ")}）` : "";
  return `- [${item.ownerRef}] ${item.kind}: ${body(item.title, item.text)}${tags}`;
}

/**
 * Assemble the text an owner pastes into their own LLM. Pure & deterministic.
 *
 * The SELF block carries the owner's FULL memory (private included) for the
 * owner's own grounding. The POOL block carries other participants' PUBLIC items,
 * each attributed only by its session-local `ownerRef` pseudonym (never a raw
 * ownerId). No item is ranked or scored.
 *
 * CONTRACT: `pool` MUST be built via `buildPublicPool(owners, { excludeOwnerId:
 * self.ownerId, ownerRefById })` — self-exclusion and the ownerRef projection are
 * enforced at build time, so this function renders the pool as given.
 */
export function buildOwnerPrompt(
  self: RigOwnerV1,
  pool: RigPublicPoolItemV1[],
  law: RigLawV1 = RIG_LAW,
): string {
  const selfBlock = [
    BLOCK_SELF,
    ...self.items.map(selfLine),
  ].join("\n");

  const poolBlock = [
    BLOCK_POOL,
    ...(pool.length > 0 ? pool.map(poolLine) : [POOL_EMPTY]),
  ].join("\n");

  const lawBlock = [
    BLOCK_LAW,
    ...law.rules.map((r, i) => `${i + 1}. ${r}`),
    law.output,
  ].join("\n");

  return [selfBlock, poolBlock, lawBlock].join("\n\n");
}
