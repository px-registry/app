// R1.5 第3便 A — provenance gate. RIG_LAW rule 7 (無ければ「今日は無い」) is an
// instruction to the owner's model; a weak model can disobey it and INVENT
// partners that were never in the pool (observed live: an empty pool still
// produced 4 cards addressed to "AIエージェントコミュニティ" etc.). The law's
// keeping is therefore backed by STRUCTURE here: a card may be shown as a
// proposal only when its addressee resolves to a real ownerRef of the pool
// that was actually sent. Pure; display-side (the raw reply stays inspectable).

import type { ProposalCard } from "./prompt.ts";

/** Cards keep their ORIGINAL index — readings are keyed by it. */
export type GatedCard = { card: ProposalCard; index: number };
export type GatedCards = { kept: GatedCard[]; excluded: GatedCard[] };

/**
 * Split cards by whether `to` resolves inside the refs captured AT GENERATION
 * TIME (ownerRef → participantRef of the sent pool). Fail-closed: anything
 * that doesn't resolve to a non-empty ref is excluded — an invented partner
 * never renders as a proposal.
 */
export function gateCardsByProvenance(
  cards: ProposalCard[],
  refs: Record<string, string>,
): GatedCards {
  const kept: GatedCard[] = [];
  const excluded: GatedCard[] = [];
  cards.forEach((card, index) => {
    const ref = refs[card.to];
    if (typeof ref === "string" && ref !== "") kept.push({ card, index });
    else excluded.push({ card, index });
  });
  return { kept, excluded };
}
