// Attested Board — public labels (EN/JA).
//
// The board's own public copy for the canonical vocabulary. N1 is law here:
// auction_like is shown as "入札型 / auction-like" — never the bare word
// "auction"/「オークション」, which waits for legal review (Stage D). These labels
// describe the OWNER's activity; none of them casts PX as seller, auctioneer,
// or settler (gate 9A-9). Kept beside the canonical so the two never drift.

import { SURFACE_SHAPES, INTENTS } from "./canonical.ts";
import type { SurfaceShape, Intent } from "./canonical.ts";

export interface Label {
  en: string;
  ja: string;
}

/** surface_shape labels. auction_like is N1-compliant (no bare "auction"). */
export const SURFACE_SHAPE_LABELS: Record<SurfaceShape, Label> = {
  offered: { en: "Offered", ja: "提供" },
  auction_like: { en: "Auction-like", ja: "入札型" },
  matching: { en: "Matching", ja: "マッチング" },
  stand: { en: "Stand", ja: "常設" },
};

/** intent labels (independent axis). */
export const INTENT_LABELS: Record<Intent, Label> = {
  wanted: { en: "Wanted", ja: "求む" },
  offered: { en: "Offering", ja: "提供" },
  ask: { en: "Ask", ja: "相談" },
};

export function surfaceShapeLabel(s: SurfaceShape): Label {
  return SURFACE_SHAPE_LABELS[s];
}
export function intentLabel(i: Intent): Label {
  return INTENT_LABELS[i];
}

/** Every public label string — the surface the wording gate (9A-9/N1) scans. */
export function allBoardLabelStrings(): string[] {
  const out: string[] = [];
  for (const s of SURFACE_SHAPES) out.push(SURFACE_SHAPE_LABELS[s].en, SURFACE_SHAPE_LABELS[s].ja);
  for (const i of INTENTS) out.push(INTENT_LABELS[i].en, INTENT_LABELS[i].ja);
  return out;
}
