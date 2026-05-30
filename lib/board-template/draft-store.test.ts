// Board Templates v1 — owner-local draft store lifecycle + publish gate. node --test.

import { test } from "node:test";
import assert from "node:assert/strict";

import { DraftBoardStore } from "./draft-store.ts";
import { InMemoryDraftBackend } from "./backend.ts";

function newStore() {
  let n = 0;
  const genId = (prefix: string) => `${prefix}_${++n}`;
  return new DraftBoardStore(new InMemoryDraftBackend(), { now: () => "2026-05-31T00:00:00.000Z", genId });
}

test("BoardTemplate-impl-2: a board can be stood up BLANK (no template) — template is not forced", () => {
  return (async () => {
    const store = newStore();
    const d = await store.create({ boardTitle: "From nothing", rows: [] });
    assert.equal(d.templateId, undefined);
    assert.equal(d.publicationState, "draft");
    // The owner adds their own row, in their own words.
    const d2 = await store.addRow(d.draftId, { surfaceShape: "stand", intent: "wanted", title: "looking for a hand" });
    assert.equal(d2.rows.length, 1);
  })();
});

test("BoardTemplate-impl-12: publish is OWNER ACTION and only succeeds once criteria pass", async () => {
  const store = newStore();
  const d = await store.create({ boardTitle: "", rows: [] });
  // Fails: no title, no row, no contact.
  await assert.rejects(() => store.publish(d.draftId), /minimum public criteria/);
  await store.rename(d.draftId, "My board");
  await store.addRow(d.draftId, { surfaceShape: "offered", intent: "offered", title: "a piece" });
  // Still fails: no contact.
  await assert.rejects(() => store.publish(d.draftId), /minimum public criteria/);
  await store.setContact(d.draftId, { kind: "manual_copy" });
  const published = await store.publish(d.draftId);
  assert.equal(published.publicationState, "public");
});

test("BoardTemplate-impl-12: there is no auto-publish — create/edit never flip state to public", async () => {
  const store = newStore();
  // Create a draft that ALREADY satisfies the criteria; it must still be draft.
  const d = await store.create({
    boardTitle: "Ready",
    rows: [{ surfaceShape: "offered", intent: "offered", title: "x" }],
    contact: { kind: "manual_copy" },
  });
  assert.equal(d.publicationState, "draft");
  // Editing it does not auto-publish either.
  const edited = await store.rename(d.draftId, "Ready 2");
  assert.equal(edited.publicationState, "draft");
});

test("BoardTemplate-impl-5: unpublish pulls a public board back to draft (kill-switch)", async () => {
  const store = newStore();
  const d = await store.create({
    boardTitle: "B",
    rows: [{ surfaceShape: "stand", intent: "ask", title: "q" }],
    contact: { kind: "manual_copy" },
  });
  await store.publish(d.draftId);
  const back = await store.unpublish(d.draftId);
  assert.equal(back.publicationState, "draft");
});

test("BoardTemplate-impl-1: rows are STRUCTURALLY validated (canonical axes required)", async () => {
  const store = newStore();
  const d = await store.create({ boardTitle: "B", rows: [] });
  // A non-canonical surface_shape (the narrowed-out "matching") is refused.
  await assert.rejects(
    () => store.addRow(d.draftId, { surfaceShape: "matching" as never, intent: "wanted", title: "x" }),
    /invalid surface_shape/,
  );
  await assert.rejects(
    () => store.addRow(d.draftId, { surfaceShape: "stand", intent: "bid" as never, title: "x" }),
    /invalid intent/,
  );
});

test("BoardTemplate-impl-13: listByState separates draft from public (owner-local view)", async () => {
  const store = newStore();
  const a = await store.create({ boardTitle: "A", rows: [{ surfaceShape: "stand", intent: "ask", title: "x" }], contact: { kind: "manual_copy" } });
  await store.create({ boardTitle: "B", rows: [] });
  await store.publish(a.draftId);
  const pub = await store.listByState("public");
  const dr = await store.listByState("draft");
  assert.deepEqual(pub.map((d) => d.boardTitle), ["A"]);
  assert.deepEqual(dr.map((d) => d.boardTitle), ["B"]);
});
