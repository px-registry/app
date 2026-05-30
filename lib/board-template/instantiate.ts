// Board Templates v1 — instantiate a scaffold into a draft (C6 boundary).
//
// ★ The C6 line, by construction: a template's `titleHint` is a PLACEHOLDER. When
// the owner starts from a template, the resulting draft rows carry the canonical
// surface_shape + intent of the suggested rows but their stored `title` is EMPTY —
// the titleHint is NEVER copied into a stored title. The UI shows the titleHint as
// the input placeholder; the owner must type their own words before the row has a
// title. So no PX-authored wording can survive into a published row.
//
// Pure and deterministic: no ids, no timestamps, no network, no store. The store's
// `create` assigns ids/timestamps later.

import type { BoardTemplateV1, NewDraftBoard, NewDraftBoardRow } from "./types.ts";

/**
 * Turn a template into a NEW draft. Every row inherits only the canonical axes
 * (surface_shape, intent); the stored `title` starts empty — the titleHint is left
 * behind as a UI placeholder, never auto-filled (C6). `boardTitle` is empty too:
 * the owner names their own board. `templateId` is recorded as provenance only.
 */
export function templateToNewDraft(template: BoardTemplateV1): NewDraftBoard {
  const rows: NewDraftBoardRow[] = template.suggestedRows.map((r) => ({
    surfaceShape: r.surfaceShape,
    intent: r.intent,
    title: "", // ← titleHint is NOT copied here (C6); it is only a placeholder
  }));
  return { boardTitle: "", rows, templateId: template.templateId };
}

/**
 * The placeholders the UI should show for a template-started draft, by row index —
 * the titleHints, kept OUT of the stored draft. Returned separately so the stored
 * draft never carries them.
 */
export function placeholdersFor(template: BoardTemplateV1): string[] {
  return template.suggestedRows.map((r) => r.titleHint);
}
