// Tests for the public projection. Run with `node --test`.
//
// The boundary between stored and public: the private owner handle never
// crosses, no pack_id ever appears, and every public record carries the
// all-true machine-readable boundary.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  toPublicRecord,
  SEED_BOARD_RECORDS,
  PRIVATE_STORED_FIELDS,
  MACHINE_READABLE_BOUNDARY,
} from "./index.ts";

const PUBLIC = SEED_BOARD_RECORDS.map(toPublicRecord);

test("no private field name survives the projection (9A-8)", () => {
  for (const rec of PUBLIC) {
    for (const priv of PRIVATE_STORED_FIELDS) {
      assert.ok(!(priv in rec), `public record leaked field "${priv}"`);
    }
  }
});

test("no private owner-handle VALUE appears anywhere in the serialized output (9A-8)", () => {
  // Stronger than key-absence: the actual auth-shaped value must not appear in
  // the JSON under any key. Seed handles are all `auth:`-prefixed.
  const blob = JSON.stringify(PUBLIC);
  for (const row of SEED_BOARD_RECORDS) {
    assert.ok(
      !blob.includes(row.ownerHandle),
      `private ownerHandle "${row.ownerHandle}" leaked into public output`,
    );
  }
  assert.ok(!blob.includes("auth:"));
});

test("only the public owner reference is exposed", () => {
  for (let i = 0; i < PUBLIC.length; i++) {
    assert.equal(PUBLIC[i].ownerPublicRef, SEED_BOARD_RECORDS[i].ownerPublicRef);
  }
});

test("no record carries a pack_id — universal id is recordId (9A-14)", () => {
  for (const rec of PUBLIC) {
    assert.ok(!("packId" in rec));
    assert.ok(!("pack_id" in rec));
    assert.equal(typeof rec.recordId, "string");
    assert.ok(rec.recordId.length > 0);
  }
});

test("every public record carries the all-true machine-readable boundary (9A-12)", () => {
  for (const rec of PUBLIC) {
    assert.deepEqual(rec.machineReadableBoundary, MACHINE_READABLE_BOUNDARY);
  }
});

test("evidence/receipt refs are present-but-empty in A1 (forward hooks)", () => {
  for (const rec of PUBLIC) {
    assert.deepEqual(rec.evidenceRefs, []);
    assert.deepEqual(rec.receiptRefs, []);
  }
});

test("projection sanitizes externalActionUrl — unsafe links are dropped (§4)", () => {
  const base = SEED_BOARD_RECORDS[0];
  const evil = toPublicRecord({ ...base, externalActionUrl: "javascript:alert(1)" });
  assert.ok(!("externalActionUrl" in evil), "unsafe action URL must be omitted");
  assert.ok(!JSON.stringify(evil).includes("javascript:"));

  const safe = toPublicRecord({ ...base, externalActionUrl: "https://ok.example/a" });
  assert.equal(safe.externalActionUrl, "https://ok.example/a");
});

test("projection is an allowlist — an injected private column is dropped", () => {
  // Simulate a future private column appearing on a stored row; the projection
  // names what it copies, so the stray field must not appear in the public form.
  const tainted = { ...SEED_BOARD_RECORDS[0], secretInternalNote: "do-not-leak" };
  // Cast through unknown: a future private column the type doesn't model yet.
  const pub = toPublicRecord(tainted as unknown as (typeof SEED_BOARD_RECORDS)[number]);
  assert.ok(!("secretInternalNote" in pub));
  assert.ok(!JSON.stringify(pub).includes("do-not-leak"));
});
