// Tests for the owner-local memory store. Run with `node --test`.
//
// Backend-agnostic logic (InMemoryBackend here; IndexedDB in the browser): the
// single validated write path, edit, export, and clear — all owner-local, no
// network. Deterministic via injected id/clock.

import { test } from "node:test";
import assert from "node:assert/strict";

import { OwnerMemoryStore, InMemoryBackend } from "./index.ts";

function freshStore() {
  let n = 0;
  return new OwnerMemoryStore(new InMemoryBackend(), {
    genId: () => `mem_${++n}`,
    now: () => `2026-05-30T00:00:0${n}Z`,
  });
}

test("create stores a typed entry with id, provenance, and timestamps", async () => {
  const s = freshStore();
  const e = await s.create({ kind: "interest", provenance: "owner_written", value: { label: "bonsai" } });
  assert.equal(e.memoryId, "mem_1");
  assert.equal(e.provenance, "owner_written");
  assert.equal(e.kind, "interest");
  assert.deepEqual(await s.list(), [e]);
});

test("create REFUSES an AI-authored fact (provenance gate)", async () => {
  const s = freshStore();
  await assert.rejects(
    // @ts-expect-error — deliberately invalid provenance.
    () => s.create({ kind: "interest", provenance: "ai_generated", value: { label: "x" } }),
    /invalid memory/,
  );
  assert.equal((await s.list()).length, 0);
});

test("create REFUSES an un-typed value (no freeform body)", async () => {
  const s = freshStore();
  await assert.rejects(
    // @ts-expect-error — wrong value shape for kind.
    () => s.create({ kind: "note", provenance: "owner_written", value: { text: 12 } }),
    /invalid memory/,
  );
});

test("update edits the typed value and bumps updatedAt", async () => {
  const s = freshStore();
  const e = await s.create({ kind: "note", provenance: "owner_written", value: { text: "first" } });
  const u = await s.update(e.memoryId, { text: "second" });
  assert.equal((u.value as { text: string }).text, "second");
  assert.notEqual(u.updatedAt, e.updatedAt);
  assert.equal(u.createdAt, e.createdAt);
});

test("listByKind filters; remove deletes", async () => {
  const s = freshStore();
  await s.create({ kind: "interest", provenance: "owner_written", value: { label: "a" } });
  const f = await s.create({ kind: "saved_filter", provenance: "owner_written", value: { surfaceShape: "stand" } });
  assert.equal((await s.listByKind("saved_filter")).length, 1);
  await s.remove(f.memoryId);
  assert.equal((await s.listByKind("saved_filter")).length, 0);
});

test("exportAll is machine-readable, includes provenance, and has no server-only fields", async () => {
  const s = freshStore();
  await s.create({ kind: "note", provenance: "owner_written", value: { text: "local secret" } });
  const dump = await s.exportAll();
  assert.equal(dump.format, "px.owner-memory/v1");
  assert.equal(dump.entries.length, 1);
  assert.equal(dump.entries[0].provenance, "owner_written");
  // No owner_handle / account / serverId fields leak into the export.
  const blob = JSON.stringify(dump);
  for (const banned of ["ownerHandle", "owner_handle", "accountId", "serverId", "sessionId"]) {
    assert.ok(!blob.includes(banned));
  }
});

test("clear empties the store (owner-local delete)", async () => {
  const s = freshStore();
  await s.create({ kind: "interest", provenance: "owner_written", value: { label: "x" } });
  await s.clear();
  assert.deepEqual(await s.list(), []);
});
