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

// ── A2: transaction-loop labels ───────────────────────────────────────────────
//
// Material, never judgment: no "completed/settled/paid/successful/safe/成立/安全".
// These describe what the OWNER does or declares, not a PX verdict on the deal.

/** Transaction event-kind labels (non-judgment). */
export const TRANSACTION_EVENT_LABELS: Record<string, Label> = {
  contact_opened: { en: "External contact opened", ja: "外部連絡先を開いた" },
  handoff_draft_created: { en: "Handoff draft", ja: "受け渡し下書き" },
  owner_declaration_created: { en: "Owner declaration", ja: "出品者の記録" },
  receipt_ref_attached: { en: "Declaration attached", ja: "記録の添付" },
};

/** Declaration-kind labels (what the owner declares took place). */
export const DECLARATION_KIND_LABELS: Record<string, Label> = {
  handoff: { en: "Handoff", ja: "受け渡し" },
  exchange: { en: "Exchange", ja: "やり取り" },
};

/** Short copy for the A2 surfaces — kept here so the wording gate can scan it. */
export const TRANSACTION_COPY = {
  contactAction: { en: "Open the owner's contact", ja: "外部連絡先を開く" },
  contactNote: {
    en: "Opens the owner's own contact. PX does not relay or store messages.",
    ja: "出品者の連絡先を開きます。PXはメッセージを仲介・保存しません。",
  },
  // Boundary-safe wording: the "does-not-settle/verify" stance is carried
  // mechanically by machineReadableBoundary, so the visible copy avoids the very
  // tokens the no-judgment gate forbids (settlement/成立/決済/保証/safe).
  declarationNote: {
    en: "The owner's own record that this took place. PX keeps the record; it does not act on it.",
    ja: "起きたことについての、出品者自身の記録です。PXは記録を残すだけです。",
  },
} as const;

/** Every A2 public label/copy string — scanned by the no-judgment gate (A2-impl-7). */
export function allTransactionLabelStrings(): string[] {
  const out: string[] = [];
  for (const k of Object.keys(TRANSACTION_EVENT_LABELS)) {
    out.push(TRANSACTION_EVENT_LABELS[k].en, TRANSACTION_EVENT_LABELS[k].ja);
  }
  for (const k of Object.keys(DECLARATION_KIND_LABELS)) {
    out.push(DECLARATION_KIND_LABELS[k].en, DECLARATION_KIND_LABELS[k].ja);
  }
  for (const v of Object.values(TRANSACTION_COPY)) out.push(v.en, v.ja);
  return out;
}
