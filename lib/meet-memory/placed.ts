// R1.5 第2便 A — 置いた問い (the waiting hand). A placed question IS a want
// card — no new server machinery: the question text becomes an owner-confirmed
// want item tagged 問い, so the existing memory→candidate flow carries it, the
// owner's own prompt grounds on it like any want, and other participants' AIs
// find it in the pool like any public item. The tag is PUBLIC and deliberate —
// it tells a reading AI "this one is a question left waiting".
//
// Pure helpers only (no store, no io); creation/withdrawal go through the
// normal validated store paths.

import type { RigMemoryItemV1 } from "../rig/rig.ts";

export const PLACED_QUESTION_TAG = "問い";

const TITLE_MAX = 16;

/** Auto-shortened one-line title draft — the owner edits freely before 確定. */
export function draftPlacedQuestionTitle(question: string): string {
  const oneLine = question.trim().replace(/\s+/g, " ");
  const firstSentence = oneLine.split(/[。．！？!?]/, 1)[0].trim();
  const s = firstSentence !== "" ? firstSentence : oneLine;
  return s.length <= TITLE_MAX ? s : `${s.slice(0, TITLE_MAX)}…`;
}

/**
 * Draft the want card for a question. `private: false` — pressing 置いておく
 * is itself the choice to be findable — but the confirm step shows the same
 * 出す/出さない toggle as everywhere else, so the owner can flip before 確定.
 */
export function draftPlacedQuestion(question: string): RigMemoryItemV1 {
  return {
    kind: "want",
    title: draftPlacedQuestionTitle(question),
    text: question.trim(),
    tags: [PLACED_QUESTION_TAG],
    private: false,
  };
}

/** A placed question is exactly: a want item carrying the 問い tag. */
export function isPlacedQuestion(item: Pick<RigMemoryItemV1, "kind" | "tags">): boolean {
  return item.kind === "want" && item.tags.includes(PLACED_QUESTION_TAG);
}
