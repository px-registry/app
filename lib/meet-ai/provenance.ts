// R1.5 第3便 A — provenance gate. RIG_LAW rule 7 (無ければ「今日は無い」) is an
// instruction to the owner's model; a weak model can disobey it and INVENT
// partners that were never in the pool (observed live: an empty pool still
// produced 4 cards addressed to "AIエージェントコミュニティ" etc.). The law's
// keeping is therefore backed by STRUCTURE here: a card may be shown as a
// proposal only when its addressee resolves to a real ownerRef of the pool
// that was actually sent. Pure; display-side (the raw reply stays inspectable).

import { parseReplyOutcome, type ProposalCard, type BasisMap } from "./prompt.ts";

/** Cards keep their ORIGINAL index — readings are keyed by it. */
export type GatedCard = { card: ProposalCard; index: number };
export type GatedCards = { kept: GatedCard[]; excluded: GatedCard[] };

/**
 * Split cards by provenance, fail-closed and unrepaired:
 *   - `to` must resolve inside the refs captured AT GENERATION TIME
 *     (ownerRef → participantRef of the sent pool) — an invented partner
 *     never renders.
 *   - 第7便 C: when the entry carries a basis map (new generations), the
 *     card's basisItemId must resolve in it AND belong to the addressee —
 *     a proposal that can't show its grounding item is not shown.
 *     Entries WITHOUT a basis map (pre-第7便 shelf) keep the to-only gate,
 *     so old proposals don't vanish retroactively.
 */
/**
 * 第8便 B — 沈黙の禁止 (the decision table, pure and pinned): every entry
 * shows exactly one face. There is no fourth, silent outcome.
 *   "cards"      — at least one card passed the gate (excluded note beside it)
 *   "none-today" — a recognized reply with nothing to show (今日は無い;
 *                  all-excluded included; raw stays in the fold)
 *   "raw"        — a format miss; the verbatim reply IS the body
 */
export type EntryFace = "cards" | "none-today" | "raw";

export function entryFace(
  raw: string,
  cards: ProposalCard[],
  refs: Record<string, string>,
  basis?: BasisMap,
): EntryFace {
  if (cards.length === 0) return parseReplyOutcome(raw).parsed ? "none-today" : "raw";
  return gateCardsByProvenance(cards, refs, basis).kept.length > 0 ? "cards" : "none-today";
}

export function gateCardsByProvenance(
  cards: ProposalCard[],
  refs: Record<string, string>,
  basis?: BasisMap,
): GatedCards {
  const kept: GatedCard[] = [];
  const excluded: GatedCard[] = [];
  cards.forEach((card, index) => {
    const ref = refs[card.to];
    const toResolves = typeof ref === "string" && ref !== "";
    const basisResolves =
      basis === undefined ||
      (card.basisItemId !== "" && basis[card.basisItemId]?.ownerRef === card.to);
    if (toResolves && basisResolves) kept.push({ card, index });
    else excluded.push({ card, index });
  });
  return { kept, excluded };
}
