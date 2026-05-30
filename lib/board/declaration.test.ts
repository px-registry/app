// Tests for owner declarations. Run with `node --test`.
//
// Declaration = material (a kind + label + timestamps + opaque id), never a
// completion/settlement judgment, never body/PII. planDeclaration ties the chain:
// it emits the declaration, the two events, and the listing's new receiptRefs.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  DECLARATION_KINDS,
  isDeclarationKind,
  toPublicDeclaration,
  attachDeclarationRef,
  planDeclaration,
  TRANSACTION_BOUNDARY,
} from "./index.ts";

test("declaration kinds are neutral material — no judgment words", () => {
  assert.deepEqual([...DECLARATION_KINDS], ["handoff", "exchange"]);
  for (const bad of ["completed", "settled", "paid", "safe", "成立", "保証"]) {
    assert.ok(!isDeclarationKind(bad));
  }
});

test("toPublicDeclaration projects public fields and stamps the boundary", () => {
  const pub = toPublicDeclaration({
    declarationId: "dec_1",
    listingRecordId: "rec-x",
    ownerPublicRef: "Hansei Press · hansei-press.example",
    kind: "handoff",
    createdAt: "2026-05-30T00:00:00Z",
  });
  assert.equal(pub.declarationId, "dec_1");
  assert.ok(!("ownerHandle" in pub));
  assert.deepEqual(pub.machineReadableBoundary, TRANSACTION_BOUNDARY);
});

test("attachDeclarationRef appends idempotently", () => {
  assert.deepEqual(attachDeclarationRef([], "dec_1"), ["dec_1"]);
  assert.deepEqual(attachDeclarationRef(["dec_1"], "dec_2"), ["dec_1", "dec_2"]);
  assert.deepEqual(attachDeclarationRef(["dec_1"], "dec_1"), ["dec_1"]); // no dup
});

test("planDeclaration emits the row, two events, and new receiptRefs (chain)", () => {
  const plan = planDeclaration({
    listingRecordId: "rec-x",
    ownerHandle: "hansei-press", // private
    ownerPublicRef: "Hansei Press · hansei-press.example",
    kind: "handoff",
    currentReceiptRefs: ["dec_old"],
    ids: { declarationId: "dec_new", declEventId: "evt_d", attachEventId: "evt_a" },
    at: "2026-05-30T00:00:00Z",
  });

  // declaration row carries the private handle (for storage), public ref, kind.
  assert.equal(plan.declaration.declarationId, "dec_new");
  assert.equal(plan.declaration.ownerHandle, "hansei-press");
  assert.equal(plan.declaration.kind, "handoff");

  // two events: owner_declaration_created + receipt_ref_attached, both ref the id.
  assert.deepEqual(plan.events.map((e) => e.kind), [
    "owner_declaration_created",
    "receipt_ref_attached",
  ]);
  assert.ok(plan.events.every((e) => e.ref === "dec_new"));

  // the listing's receiptRefs now include the new declaration id (A2-impl-3).
  assert.deepEqual(plan.newReceiptRefs, ["dec_old", "dec_new"]);
});

test("planDeclaration refuses a non-public-safe ownerPublicRef (no private leak)", () => {
  const base = {
    listingRecordId: "rec-x",
    ownerHandle: "h",
    kind: "handoff" as const,
    currentReceiptRefs: [],
    ids: { declarationId: "dec_1", declEventId: "e1", attachEventId: "e2" },
    at: "t",
  };
  assert.throws(() => planDeclaration({ ...base, ownerPublicRef: "auth:hansei-7f3a" }));
  assert.throws(() => planDeclaration({ ...base, ownerPublicRef: "owner@example.com" }));
});
