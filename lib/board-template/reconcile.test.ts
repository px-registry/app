// UI Wiring v0 — reconciliation state machine + store integration. node --test.
//
// Proves the "server-confirmed only" model: rows become public ONLY on a confirmed
// publish (matched by localRowId, never array order), local edits never silently
// update the server (MF4), an ambiguous result is `unknown` not public (MF2), and
// unpublish only retires on a confirmed success. All pure / owner-local — no network.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  rowServerStateKind,
  publishedRecordIdOf,
  serverAfterEdit,
  rowContentChanged,
} from "./reconcile.ts";
import { DraftBoardStore } from "./draft-store.ts";
import { InMemoryDraftBackend } from "./backend.ts";

function newStore() {
  let n = 0;
  const genId = (prefix: string) => `${prefix}_${++n}`;
  return new DraftBoardStore(new InMemoryDraftBackend(), { now: () => "2026-05-31T00:00:00.000Z", genId });
}
async function publishedDraft(store: DraftBoardStore) {
  const d = await store.create({
    boardTitle: "B",
    rows: [
      { surfaceShape: "stand", intent: "wanted", title: "row A" },
      { surfaceShape: "offered", intent: "offered", title: "row B" },
    ],
    contact: { kind: "public_external_link", externalActionUrl: "https://x.example/c" },
  });
  return d;
}

// ── pure derivation / transitions ─────────────────────────────────────────────

test("UIW-impl-1: a row with no server state reads as local; published/edited expose the live recordId", () => {
  assert.equal(rowServerStateKind({}), "local");
  assert.equal(rowServerStateKind({ server: { kind: "public", recordId: "rec_1" } }), "public");
  assert.equal(publishedRecordIdOf({ server: { kind: "public", recordId: "rec_1" } }), "rec_1");
  assert.equal(publishedRecordIdOf({ server: { kind: "local-edits-not-published", recordId: "rec_1" } }), "rec_1");
  // retired / unknown have NO live record (cannot be unpublished again).
  assert.equal(publishedRecordIdOf({ server: { kind: "retired", recordId: "rec_1" } }), undefined);
  assert.equal(publishedRecordIdOf({ server: { kind: "unknown" } }), undefined);
});

test("UIW-impl-2: serverAfterEdit — public→edited (recordId kept), retired/unknown→local", () => {
  assert.deepEqual(serverAfterEdit({ kind: "public", recordId: "rec_1" }), { kind: "local-edits-not-published", recordId: "rec_1" });
  assert.deepEqual(serverAfterEdit({ kind: "local-edits-not-published", recordId: "rec_1" }), { kind: "local-edits-not-published", recordId: "rec_1" });
  assert.equal(serverAfterEdit({ kind: "retired", recordId: "rec_1" }), undefined);
  assert.equal(serverAfterEdit({ kind: "unknown" }), undefined);
  assert.equal(serverAfterEdit(undefined), undefined);
});

test("UIW-impl-3: rowContentChanged compares the published material only", () => {
  const base = { surfaceShape: "stand", intent: "wanted", title: "t" } as const;
  assert.equal(rowContentChanged(base, { ...base }), false);
  assert.equal(rowContentChanged(base, { ...base, title: "t2" }), true);
  assert.equal(rowContentChanged(base, { ...base, summary: "s" }), true);
});

// ── store: server-confirmed publish ───────────────────────────────────────────

test("UIW-impl-4: applyPublishResult marks ONLY confirmed rows public, matched by localRowId (not order)", async () => {
  const store = newStore();
  const d = await publishedDraft(store);
  const [r0, r1] = d.rows;
  // Confirm in REVERSE order to prove matching is by id, not array position.
  const after = await store.applyPublishResult(d.draftId, [
    { localRowId: r1.rowId, recordId: "rec_B" },
    { localRowId: r0.rowId, recordId: "rec_A" },
  ]);
  assert.deepEqual(after.rows.map((r) => r.server), [
    { kind: "public", recordId: "rec_A" },
    { kind: "public", recordId: "rec_B" },
  ]);
});

test("UIW-impl-5 (fail-closed): an empty / partial confirmation never makes an unconfirmed row public", async () => {
  const store = newStore();
  const d = await publishedDraft(store);
  const after = await store.applyPublishResult(d.draftId, []); // publish failed → nothing confirmed
  assert.deepEqual(after.rows.map((r) => rowServerStateKind(r)), ["local", "local"]);
  // Only row 0 confirmed → row 1 stays local (not public).
  const partial = await store.applyPublishResult(d.draftId, [{ localRowId: d.rows[0].rowId, recordId: "rec_A" }]);
  assert.deepEqual(partial.rows.map((r) => rowServerStateKind(r)), ["public", "local"]);
});

test("UIW-impl-6 (MF2): markRowsUnknown sets unknown — not public", async () => {
  const store = newStore();
  const d = await publishedDraft(store);
  const after = await store.markRowsUnknown(d.draftId, d.rows.map((r) => r.rowId));
  assert.deepEqual(after.rows.map((r) => rowServerStateKind(r)), ["unknown", "unknown"]);
  assert.equal(publishedRecordIdOf(after.rows[0]), undefined);
});

// ── store: edit-after-publish (MF4) ───────────────────────────────────────────

test("UIW-impl-7 (MF4): editing a public row → local-edits-not-published (recordId kept); a no-op edit stays public", async () => {
  const store = newStore();
  const d = await publishedDraft(store);
  await store.applyPublishResult(d.draftId, d.rows.map((r) => ({ localRowId: r.rowId, recordId: `rec_${r.rowId}` })));
  const edited = await store.updateRow(d.draftId, d.rows[0].rowId, { title: "row A edited" });
  assert.equal(rowServerStateKind(edited.rows[0]), "local-edits-not-published");
  assert.equal(publishedRecordIdOf(edited.rows[0]), `rec_${d.rows[0].rowId}`); // recordId preserved across the edit
  // Re-writing the SAME content does not move a public row.
  const noop = await store.updateRow(d.draftId, d.rows[1].rowId, { title: "row B" });
  assert.equal(rowServerStateKind(noop.rows[1]), "public");
});

test("UIW-impl-8 (MF4): changing the contact marks public rows local-edits-not-published", async () => {
  const store = newStore();
  const d = await publishedDraft(store);
  await store.applyPublishResult(d.draftId, d.rows.map((r) => ({ localRowId: r.rowId, recordId: `rec_${r.rowId}` })));
  const after = await store.setContact(d.draftId, { kind: "public_external_link", externalActionUrl: "https://x.example/NEW" });
  assert.deepEqual(after.rows.map((r) => rowServerStateKind(r)), ["local-edits-not-published", "local-edits-not-published"]);
});

// ── store: server-confirmed unpublish ─────────────────────────────────────────

test("UIW-impl-9: applyUnpublishResult retires only the row holding that live recordId", async () => {
  const store = newStore();
  const d = await publishedDraft(store);
  await store.applyPublishResult(d.draftId, [
    { localRowId: d.rows[0].rowId, recordId: "rec_A" },
    { localRowId: d.rows[1].rowId, recordId: "rec_B" },
  ]);
  const after = await store.applyUnpublishResult(d.draftId, "rec_A");
  assert.equal(rowServerStateKind(after.rows[0]), "retired");
  assert.equal(rowServerStateKind(after.rows[1]), "public"); // untouched
});

test("UIW-impl-10: a live (public) row cannot be removed — unpublish first (orphan prevention)", async () => {
  const store = newStore();
  const d = await publishedDraft(store);
  await store.applyPublishResult(d.draftId, [{ localRowId: d.rows[0].rowId, recordId: "rec_A" }]);
  await assert.rejects(() => store.removeRow(d.draftId, d.rows[0].rowId), /unpublish this row before removing/);
  // After it is retired, it can be removed.
  await store.applyUnpublishResult(d.draftId, "rec_A");
  const after = await store.removeRow(d.draftId, d.rows[0].rowId);
  assert.equal(after.rows.length, 1);
});
