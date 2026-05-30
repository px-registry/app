// Board Templates v1 — minimum public criteria are STRUCTURAL only. node --test.

import { test } from "node:test";
import assert from "node:assert/strict";

import { evaluatePublicCriteria, meetsPublicCriteria } from "./criteria.ts";
import type { DraftBoardV1 } from "./types.ts";

function draft(over: Partial<DraftBoardV1>): DraftBoardV1 {
  return {
    draftId: "draft_x",
    boardTitle: "",
    rows: [],
    publicationState: "draft",
    createdAt: "t",
    updatedAt: "t",
    ...over,
  };
}

const oneRow = [{ rowId: "row_1", surfaceShape: "offered", intent: "offered", title: "anything" }] as const;

test("BoardTemplate-impl-3: a full board (title + row + contact) passes", () => {
  const d = draft({ boardTitle: "My board", rows: [...oneRow], contact: { kind: "manual_copy" } });
  assert.deepEqual(evaluatePublicCriteria(d), { ok: true, missing: [] });
  assert.equal(meetsPublicCriteria(d), true);
});

test("BoardTemplate-impl-3: each missing structural condition is reported, in order", () => {
  assert.deepEqual(evaluatePublicCriteria(draft({})).missing, ["title", "row", "contact"]);
  assert.deepEqual(
    evaluatePublicCriteria(draft({ boardTitle: "t" })).missing,
    ["row", "contact"],
  );
  assert.deepEqual(
    evaluatePublicCriteria(draft({ boardTitle: "t", rows: [...oneRow] })).missing,
    ["contact"],
  );
});

test("BoardTemplate-impl-3: a whitespace-only title is not a title (existence, trimmed)", () => {
  const d = draft({ boardTitle: "   ", rows: [...oneRow], contact: { kind: "manual_copy" } });
  assert.deepEqual(evaluatePublicCriteria(d).missing, ["title"]);
});

test("BoardTemplate-impl-3: criteria check is CONTENT-BLIND — row/title text never judged", () => {
  // Two drafts identical in STRUCTURE but with wildly different content text both
  // pass identically. The gate has no branch that reads quality.
  const a = draft({ boardTitle: "x", rows: [{ rowId: "r", surfaceShape: "stand", intent: "ask", title: "a" }], contact: { kind: "manual_copy" } });
  const b = draft({ boardTitle: "とても長い説明文 ......", rows: [{ rowId: "r", surfaceShape: "stand", intent: "ask", title: "別の内容" }], contact: { kind: "manual_copy" } });
  assert.equal(meetsPublicCriteria(a), meetsPublicCriteria(b));
  assert.equal(meetsPublicCriteria(a), true);
});

test("BoardTemplate-impl-4: an empty (0-row) board cannot meet criteria (empty-board prevention)", () => {
  const d = draft({ boardTitle: "title only", contact: { kind: "manual_copy" } });
  assert.equal(meetsPublicCriteria(d), false);
  assert.ok(evaluatePublicCriteria(d).missing.includes("row"));
});

test("BoardTemplate-impl-3: all three contact-readiness kinds satisfy criterion #3", () => {
  const base = { boardTitle: "t", rows: [...oneRow] };
  assert.equal(meetsPublicCriteria(draft({ ...base, contact: { kind: "manual_copy" } })), true);
  assert.equal(meetsPublicCriteria(draft({ ...base, contact: { kind: "public_external_link", externalActionUrl: "https://x.test/" } })), true);
  assert.equal(meetsPublicCriteria(draft({ ...base, contact: { kind: "owner_provided_limited_external_invite", externalActionUrl: "https://x.test/i" } })), true);
});
