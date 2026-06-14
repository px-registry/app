// 記憶装置 層1a — journal の pin。Run with `node --test`.
//
//   JN-1  append-only: store has no update(); 変異経路は append / appendEvent /
//         supersede / restore だけ（in-place 変異は不在）
//   JN-2  seq は端末ローカル単調増加・穴なし（=長さ）
//   JN-3  AI provenance は validator が弾く（substrate と同根の線）／append も throw
//   JN-4  discriminated union 整合: event に body ✕ / content に body 必須 /
//         witnessSource は channel==="witness" の時だけ
//   JN-5  supersede 連鎖は最新優先（heads は非 head を落とす・長さは保つ）
//   JN-6  忘却は append（forget tombstone）: heads から外れるが length に残る
//   JN-7  sourceRef の object union 検証（不正な channel / 型は弾く）
//   JN-8  控え v2 round-trip: journal を verbatim 復元（recordId/seq 保存）

import { test } from "node:test";
import assert from "node:assert/strict";

import { InMemoryKeyedBackend } from "./backend.ts";
import { MeetMemoryStore } from "./store.ts";
import { MemJournalStore } from "./journal.ts";
import { validateJournalRecord } from "./validate.ts";
import type { MemJournalRecordV1, NewContentRecordV1 } from "./journal-types.ts";
import { mintEncKeyPair } from "../meet-crypto/keys.ts";
import { sealPrivateKey } from "../meet-crypto/seal.ts";

function freshJournal(): MemJournalStore {
  let n = 0;
  return new MemJournalStore(new InMemoryKeyedBackend<MemJournalRecordV1>((r) => r.recordId), {
    now: () => "2026-06-15T00:00:00.000Z",
    genId: () => `mem-${++n}`,
  });
}

const NOTE: NewContentRecordV1 = {
  contentKind: "rig_item",
  provenance: "owner_written",
  sourceRef: { channel: "note" },
  body: { kind: "memory", title: "原点", text: "祖父の印刷所で育った", tags: ["手仕事"], private: true },
};

// ── JN-1: append-only ───────────────────────────────────────────────────────────

test("JN-1: the journal store exposes no update() — append-only by shape", () => {
  const j = freshJournal();
  assert.equal(typeof (j as unknown as { update?: unknown }).update, "undefined");
});

// ── JN-2: seq monotonic, gap-free ────────────────────────────────────────────────

test("JN-2: seq is device-local monotonic with no gaps (= the length)", async () => {
  const j = freshJournal();
  await j.append(NOTE);
  await j.append({ ...NOTE, body: { ...NOTE.body, text: "二枚目" } });
  await j.appendEvent({ eventKind: "surface", provenance: "owner_written", sourceRef: { channel: "note" }, targetRef: "mem-1" });
  const all = await j.list();
  assert.deepEqual(all.map((r) => r.seq), [0, 1, 2]);
});

test("JN-2b: listSince returns the tail after a seq", async () => {
  const j = freshJournal();
  await j.append(NOTE);
  await j.append(NOTE);
  await j.append(NOTE);
  assert.deepEqual((await j.listSince(0)).map((r) => r.seq), [1, 2]);
});

// ── JN-3: AI provenance refused ──────────────────────────────────────────────────

test("JN-3: an AI-authored record is refused at the validator", () => {
  for (const provenance of ["ai_generated", "agent", "", undefined]) {
    const rec = { recordId: "x", seq: 0, createdAt: "t", provenance, sourceRef: { channel: "note" }, recordType: "content", contentKind: "rig_item", body: NOTE.body };
    assert.equal(validateJournalRecord(rec).ok, false, `provenance ${String(provenance)} must be refused`);
  }
});

test("JN-3b: append rejects a bad-provenance record (throws, never persists)", async () => {
  const j = freshJournal();
  await assert.rejects(() => j.append({ ...NOTE, provenance: "ai_generated" as never }));
  assert.equal((await j.list()).length, 0);
});

// ── JN-4: discriminated-union integrity at runtime ──────────────────────────────

test("JN-4: event must not carry a body; content must carry one", () => {
  const eventWithBody = { recordId: "e", seq: 0, createdAt: "t", provenance: "owner_written", sourceRef: { channel: "note" }, recordType: "event", eventKind: "surface", targetRef: "mem-1", body: NOTE.body };
  assert.equal(validateJournalRecord(eventWithBody).ok, false, "event + body refused");
  const contentNoBody = { recordId: "c", seq: 0, createdAt: "t", provenance: "owner_written", sourceRef: { channel: "note" }, recordType: "content", contentKind: "rig_item" };
  assert.equal(validateJournalRecord(contentNoBody).ok, false, "content without body refused");
});

test("JN-4b: witnessSource only when sourceRef.channel === witness", () => {
  const onNote = { recordId: "w", seq: 0, createdAt: "t", provenance: "owner_imported_confirmed", sourceRef: { channel: "note" }, recordType: "content", contentKind: "rig_item", body: NOTE.body, witnessSource: "payment" };
  assert.equal(validateJournalRecord(onNote).ok, false, "witnessSource on a note channel is refused");
  const onWitness = { recordId: "w2", seq: 0, createdAt: "t", provenance: "owner_imported_confirmed", sourceRef: { channel: "witness", witnessRef: "r" }, recordType: "content", contentKind: "rig_item", body: NOTE.body, witnessSource: "payment" };
  assert.equal(validateJournalRecord(onWitness).ok, true, "witnessSource on a witness channel passes");
  const badKind = { ...onWitness, recordId: "w3", witnessSource: "nope" };
  assert.equal(validateJournalRecord(badKind).ok, false, "unknown witnessSource refused");
});

// ── JN-5: supersede chain — latest wins ──────────────────────────────────────────

test("JN-5: supersede appends a head; the old record stays in the length", async () => {
  const j = freshJournal();
  const first = await j.append(NOTE); // mem-1
  await j.supersede(first.recordId, { ...NOTE, body: { ...NOTE.body, text: "訂正後" } }); // mem-2
  const heads = await j.heads();
  assert.equal(heads.length, 1, "only the head survives the fold");
  assert.equal(heads[0].recordType === "content" && heads[0].body.text, "訂正後");
  assert.equal((await j.list()).length, 2, "the superseded record stays in the length");
});

// ── JN-6: forget is an append (tombstone) ────────────────────────────────────────

test("JN-6: forget drops from heads but the length keeps it", async () => {
  const j = freshJournal();
  const r = await j.append(NOTE); // mem-1
  await j.appendEvent({ eventKind: "forget", provenance: "owner_written", sourceRef: { channel: "note" }, targetRef: r.recordId });
  assert.equal((await j.heads()).length, 0, "forgotten content leaves the default view");
  assert.equal((await j.list()).length, 2, "but forget is itself an append — nothing is deleted");
  // 最新優先: a later surface re-raises it.
  await j.appendEvent({ eventKind: "surface", provenance: "owner_written", sourceRef: { channel: "note" }, targetRef: r.recordId });
  assert.equal((await j.heads()).length, 1, "the latest event wins");
});

// ── JN-7: sourceRef object-union validation ──────────────────────────────────────

test("JN-7: sourceRef must be a valid {channel,...} union", () => {
  const base = { recordId: "s", seq: 0, createdAt: "t", provenance: "owner_written", recordType: "content", contentKind: "note", body: NOTE.body };
  assert.equal(validateJournalRecord({ ...base, sourceRef: { channel: "nope" } }).ok, false);
  assert.equal(validateJournalRecord({ ...base, sourceRef: "note" }).ok, false);
  assert.equal(validateJournalRecord({ ...base, sourceRef: { channel: "import", importKind: "weird" } }).ok, false);
  assert.equal(validateJournalRecord({ ...base, sourceRef: { channel: "import", importKind: "cold_start", batchId: "b1" } }).ok, true);
  assert.equal(validateJournalRecord({ ...base, sourceRef: { channel: "talk", threadRef: "t1", messageRef: "m1" } }).ok, true);
});

// ── JN-8: 控え v2 round-trip restores the journal verbatim ───────────────────────

test("JN-8: export v2 → clear → import restores journal records verbatim", async () => {
  const journal = freshJournal();
  const store = new MeetMemoryStore(new InMemoryKeyedBackend(), {
    now: () => "2026-06-15T00:00:00.000Z",
    genId: () => "id-1",
    journal,
  });
  await store.create({ kind: "rig_item", provenance: "owner_written", value: { kind: "have", title: "t", text: "x", tags: [], private: false } });
  const a = await journal.append(NOTE);
  await journal.supersede(a.recordId, { ...NOTE, body: { ...NOTE.body, text: "v2" } });
  const dump = await store.exportAll();
  assert.equal(dump.journal.length, 2);

  // Fresh target store + fresh journal — restore from the bundle string.
  const journal2 = freshJournal();
  const store2 = new MeetMemoryStore(new InMemoryKeyedBackend(), { journal: journal2 });
  const report = await store2.importBackup(JSON.stringify(dump));
  assert.equal(report.added, 1);
  assert.equal(report.journalRestored, 2);
  assert.equal(report.journalRejected, 0);
  const restored = await journal2.list();
  assert.deepEqual(restored.map((r) => r.recordId), [a.recordId, "mem-2"]);
  assert.deepEqual(restored.map((r) => r.seq), [0, 1], "seq preserved verbatim");
});

// ── JN-9: the bundle never leaks the private scalar (0013 invariant 6) ───────────

test("JN-9: a passphrase-less export carries no private scalar 'd'", async () => {
  const journal = freshJournal();
  const store = new MeetMemoryStore(new InMemoryKeyedBackend(), { journal });
  await store.create({ kind: "rig_item", provenance: "owner_written", value: { kind: "have", title: "t", text: "x", tags: [], private: false } });
  await journal.append(NOTE);
  const dump = await store.exportAll(); // no sealedKey → safe default preserved
  assert.equal(dump.sealedKey, undefined, "no passphrase ⇒ no sealedKey ⇒ priv stays on device");
  assert.ok(!JSON.stringify(dump).includes('"d"'), "no private scalar in a passphrase-less 控え");
});

test("JN-9b: even WITH a sealedKey the priv is opaque — no plaintext 'd'", async () => {
  const journal = freshJournal();
  const store = new MeetMemoryStore(new InMemoryKeyedBackend(), { journal });
  const kp = await mintEncKeyPair();
  const sealedKey = await sealPrivateKey(kp.priv, "owner-pw");
  const dump = await store.exportAll({ sealedKey });
  assert.ok(dump.sealedKey !== undefined, "opt-in sealedKey rides the v2 bundle");
  const json = JSON.stringify(dump);
  assert.ok(!json.includes('"d"'), "the sealed key is ciphertext — no plaintext scalar");
  assert.ok(typeof kp.priv.d === "string" && !json.includes(kp.priv.d as string), "raw scalar value absent");
});

test("JN-8b: a broken journal record is skipped, the rest survive (fail-closed)", async () => {
  const journal = freshJournal();
  const store = new MeetMemoryStore(new InMemoryKeyedBackend(), { journal });
  const good: MemJournalRecordV1 = {
    recordId: "ok", seq: 0, createdAt: "t", provenance: "owner_written",
    sourceRef: { channel: "note" }, recordType: "content", contentKind: "note", body: NOTE.body,
  };
  const bundle = {
    format: "px.meet-memory/v2",
    exportedAt: "t",
    entries: [],
    journal: [good, { recordId: "bad", seq: 1, recordType: "event" /* missing fields */ }],
  };
  const report = await store.importBackup(JSON.stringify(bundle));
  assert.equal(report.journalRestored, 1);
  assert.equal(report.journalRejected, 1);
});
