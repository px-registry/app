// Board Templates v1 — template is a SCAFFOLD; titleHint is never auto-filled. node --test.

import { test } from "node:test";
import assert from "node:assert/strict";

import { BOARD_TEMPLATES } from "./catalog.ts";
import { templateToNewDraft, placeholdersFor } from "./instantiate.ts";

test("BoardTemplate-impl-15: instantiating a template NEVER copies titleHint into a stored title (C6)", () => {
  for (const template of BOARD_TEMPLATES) {
    const draft = templateToNewDraft(template);
    // Board title starts empty — the owner names their own board.
    assert.equal(draft.boardTitle, "");
    assert.equal(draft.rows.length, template.suggestedRows.length);
    for (let i = 0; i < draft.rows.length; i++) {
      const row = draft.rows[i];
      const hint = template.suggestedRows[i].titleHint;
      // The stored title is empty, and is NOT the titleHint.
      assert.equal(row.title, "");
      assert.notEqual(row.title, hint);
      // The canonical axes ARE inherited (a row is a concrete slot).
      assert.equal(row.surfaceShape, template.suggestedRows[i].surfaceShape);
      assert.equal(row.intent, template.suggestedRows[i].intent);
    }
    // templateId is recorded as provenance only.
    assert.equal(draft.templateId, template.templateId);
  }
});

test("BoardTemplate-impl-15: placeholders are returned SEPARATELY, kept out of the stored draft", () => {
  const t = BOARD_TEMPLATES[0];
  const ph = placeholdersFor(t);
  assert.deepEqual(ph, t.suggestedRows.map((r) => r.titleHint));
  // The draft JSON does not contain any titleHint string.
  const draftBlob = JSON.stringify(templateToNewDraft(t));
  for (const hint of ph) assert.ok(!draftBlob.includes(hint), `stored draft must not carry the hint "${hint}"`);
});
