// Stage B+1 — proposal copy (thin-honest; must not read as a PX recommendation).
//
// Allowed phrasing only: a proposal is "your own AI's suggestion, grounded in
// your memory, composed on your device". It never claims PX learns you, ranks,
// optimizes, or picks "best/top/popular" candidates. The reason labels name the
// grounding memory kind so the owner can inspect it. These strings are scanned by
// the forbidden-copy gate.

import type { ProposalReason } from "./types.ts";

export interface Label {
  en: string;
  ja: string;
}

export const PROPOSAL_REASON_LABELS: Record<ProposalReason["kind"], Label> = {
  matches_saved_filter: { en: "Matches your saved filter", ja: "あなたの保存条件に合う候補" },
  matches_saved_interest: { en: "Matches your interest", ja: "あなたのメモリに基づく候補" },
  // ★ #4 — a candidate ACROSS intents (wanted ⇄ offered). "candidate", never a
  // match/成立/fit; grounded in the owner's saved position.
  cross_intent_candidate: { en: "A candidate across wanted ⇄ offered", ja: "wanted⇄offered を横断した候補" },
};

export const PROPOSAL_COPY = {
  heading: { en: "Your AI's suggestions", ja: "あなたのAIの提案" },
  empty: {
    en: "Not much memory yet — no suggestions to show.",
    ja: "メモリが少ないため候補はまだありません",
  },
  note: {
    en: "Grounded in your own memory, composed on your device.",
    ja: "あなた自身のメモリに基づき、あなたの端末で作られた候補です。",
  },
  // The cross-intent framing: candidates to reach out to, never a PX-made meeting.
  crossIntentNote: {
    en: "Across wanted ⇄ offered — candidates to reach out to with your own tools. You decide; PX joins no one.",
    ja: "wanted⇄offered を横断した候補です。あなたが判断し、自分のツールでつながります。PXは誰もつなぎません。",
  },
} as const;

export function reasonLabel(reason: ProposalReason): Label {
  return PROPOSAL_REASON_LABELS[reason.kind];
}

/** Every B+1 public copy string — scanned by the forbidden-copy gate. */
export function allProposalCopyStrings(): string[] {
  const out: string[] = [];
  for (const k of Object.keys(PROPOSAL_REASON_LABELS) as ProposalReason["kind"][]) {
    out.push(PROPOSAL_REASON_LABELS[k].en, PROPOSAL_REASON_LABELS[k].ja);
  }
  for (const v of Object.values(PROPOSAL_COPY)) out.push(v.en, v.ja);
  return out;
}
