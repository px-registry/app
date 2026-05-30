// Board Templates v1 — the template catalog (SCAFFOLDS, fixed neutral order).
//
// These are STARTING POINTS, not prescriptions. The owner may edit any of them,
// ignore them, or start from a blank board entirely (template is never forced —
// see `blankDraft`). Each is canonical-compliant (surface_shape 3 / intent 3) and
// nothing more: there is no rank, score, popularity, "best", or "recommended"
// signal anywhere, and the array order is FIXED registration order — NOT a ranking
// (C5). PX attaches no ordering judgment (§5).
//
// The five beta use cases (bonsai / designer / 3D / ensemble / standing shop) are
// here only as "a starting point like this exists" — never "use this one". Every
// titleHint is a PLACEHOLDER the owner rewrites (C6); it is deliberately a generic
// prompt so PX prescribes no content of its own.

import type { BoardTemplateV1, NewDraftBoard } from "./types.ts";

/**
 * The fixed catalog. Order is registration order and carries no judgment; the UI
 * renders it as-is (no usage/personalized/popular sort — C5). New templates are
 * appended deliberately, never reordered by any signal.
 */
export const BOARD_TEMPLATES: readonly BoardTemplateV1[] = Object.freeze([
  {
    templateId: "bonsai_commission",
    useCaseLabel: "一点物・制作依頼 · One-of-a-kind / commission",
    suggestedRows: [
      { surfaceShape: "offered", intent: "offered", titleHint: "(例) 一点もの／制作依頼の内容を書く" },
      { surfaceShape: "auction_like", intent: "offered", titleHint: "(例) 入札を受け付ける一点ものを書く" },
    ],
  },
  {
    templateId: "design_commission",
    useCaseLabel: "デザイン依頼 · Design commission",
    suggestedRows: [
      { surfaceShape: "offered", intent: "offered", titleHint: "(例) 受けている制作の内容を書く" },
      { surfaceShape: "stand", intent: "ask", titleHint: "(例) 相談を受け付ける内容を書く" },
    ],
  },
  {
    templateId: "three_d_make",
    useCaseLabel: "3D制作・出力 · 3D make / print",
    suggestedRows: [
      { surfaceShape: "offered", intent: "offered", titleHint: "(例) 出力・制作で提供できる内容を書く" },
      { surfaceShape: "offered", intent: "wanted", titleHint: "(例) 探している協力者を書く" },
    ],
  },
  {
    templateId: "ensemble_recruit",
    useCaseLabel: "仲間・スタッフ募集 · Bandmates / staff",
    suggestedRows: [
      { surfaceShape: "stand", intent: "wanted", titleHint: "(例) 探している人・役割を書く" },
      { surfaceShape: "stand", intent: "ask", titleHint: "(例) 相談したい内容を書く" },
    ],
  },
  {
    templateId: "standing_notice",
    useCaseLabel: "お店・常設の告知 · Shop / standing notice",
    suggestedRows: [
      { surfaceShape: "stand", intent: "offered", titleHint: "(例) 常設で知らせたい内容を書く" },
      { surfaceShape: "stand", intent: "wanted", titleHint: "(例) 探している協力者を書く" },
    ],
  },
]);

/** Look up a template by id (UI placeholder rendering). */
export function findTemplate(templateId: string): BoardTemplateV1 | undefined {
  return BOARD_TEMPLATES.find((t) => t.templateId === templateId);
}

/**
 * A blank starting point — template is NEVER forced (§1). The owner can stand a
 * board from nothing and add their own rows. This carries no templateId.
 */
export function blankDraft(): NewDraftBoard {
  return { boardTitle: "", rows: [] };
}
