// Stage A2 acceptance gates — explicit roll-up. Run with `node --test`.
//
// The 8 implementation gates + the GPT hard-requirements, each asserted by id.
// Behavioural gates that need the handler/D1 live in functions/api/board/event.test.ts
// (noted inline); this file holds the pure-logic + structural (source/schema) proofs.
//
//   A2-impl-1 listing→inquiry route ........ functions/api/board/event.test.ts + contact.ts
//   A2-impl-2 handoff = owner external action functions test (+ transaction.test.ts)
//   A2-impl-3 receipt→receiptRefs ........... declaration.test.ts + here
//   A2-impl-4 transaction object chains ..... transaction.test.ts + here
//   A2-impl-5 no inquiry body/PII in backend  here (schema+source) + functions test
//   A2-impl-6 no payment/escrow/execution ... here (source) + functions test (authz)
//   A2-impl-7 receipt = material not judgment here (wording)
//   A2-impl-8 boundary on transaction object  here + declaration.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  buildTransactionObject,
  planDeclaration,
  toPublicDeclaration,
  TRANSACTION_EVENT_KINDS,
  DECLARATION_KINDS,
  TRANSACTION_BOUNDARY,
  MACHINE_READABLE_BOUNDARY,
  allTransactionLabelStrings,
  SEED_BOARD_RECORDS,
} from "./index.ts";

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");
const stripSql = (s: string) => s.replace(/--.*$/gm, "");
const stripJs = (s: string) => s.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");

// Body/PII column names that must never exist anywhere in the A2 write path.
const PII_COLUMNS = ["message", "body", "email", "phone", "counterparty"];

// ── A2-impl-5: no message body / PII stored (schema + source) ────────────────────

test("A2-impl-5: A2 tables declare no body/PII columns", () => {
  for (const m of ["0003_transaction_events.sql", "0004_declarations.sql"]) {
    const ddl = stripSql(read(`../../migrations/${m}`)).toLowerCase();
    for (const col of PII_COLUMNS) {
      assert.ok(!ddl.includes(col), `${m} must not declare a "${col}" column`);
    }
  }
});

test("A2-impl-5: the transaction Function reads/writes no body/PII columns", () => {
  const src = stripJs(read("../../functions/_transaction.ts")).toLowerCase();
  for (const col of PII_COLUMNS) {
    assert.ok(!src.includes(col), `_transaction.ts must not reference a "${col}" column`);
  }
  // Discipline: no SELECT *, and the declarations read never selects owner_handle.
  assert.ok(!/select\s+\*/i.test(src));
  assert.ok(src.includes("from declarations"), "declarations read must exist");
  const declBlock = src.slice(src.indexOf("select declaration_id"), src.indexOf("from declarations"));
  assert.ok(declBlock.length > 0, "declarations SELECT column list must exist");
  assert.ok(!declBlock.includes("owner_handle"), "owner_handle must not be selected publicly");
});

// ── A2-impl-6: no payment/escrow/execution ──────────────────────────────────────

test("A2-impl-6: no payment/escrow/settlement primitives in the A2 write path", () => {
  const src = stripJs(read("../../functions/_transaction.ts")).toLowerCase();
  for (const banned of ["payment", "escrow", "charge", "stripe", "paypal", "settle("]) {
    assert.ok(!src.includes(banned), `_transaction.ts must not reference "${banned}"`);
  }
});

// ── A2-impl-7: declaration/event vocab is material, not judgment ─────────────────

test("A2-impl-7: no judgment/settlement wording in kinds or labels", () => {
  const surface = [
    ...TRANSACTION_EVENT_KINDS,
    ...DECLARATION_KINDS,
    ...allTransactionLabelStrings(),
  ]
    .join("\n")
    .toLowerCase();
  for (const banned of [
    "completed",
    "settled",
    "paid",
    "successful",
    "deal completed",
    "transaction completed",
    "payment receipt",
    "settlement",
    "safe",
    "成立",
    "安全",
    "決済",
    "保証",
  ]) {
    assert.ok(!surface.includes(banned), `judgment wording present: "${banned}"`);
  }
});

test("A2-impl-7: the migration CHECK lists hold only neutral kinds", () => {
  const events = stripSql(read("../../migrations/0003_transaction_events.sql"));
  const decls = stripSql(read("../../migrations/0004_declarations.sql"));
  for (const banned of ["completed", "settled", "paid", "successful", "safe"]) {
    assert.ok(!events.toLowerCase().includes(banned));
    assert.ok(!decls.toLowerCase().includes(banned));
  }
});

// ── A2-impl-3/4: the chain connects (pure) ──────────────────────────────────────

test("A2-impl-3/4: declaration fills receiptRefs and the object chains it", () => {
  const plan = planDeclaration({
    listingRecordId: "rec-x",
    ownerHandle: "alice",
    ownerPublicRef: "Alice · alice.example",
    kind: "handoff",
    currentReceiptRefs: [],
    ids: { declarationId: "dec_1", declEventId: "evt_d", attachEventId: "evt_a" },
    at: "2026-05-30T00:00:00Z",
  });
  assert.deepEqual(plan.newReceiptRefs, ["dec_1"]); // A2-impl-3
  const obj = buildTransactionObject("rec-x", plan.events); // A2-impl-4
  assert.deepEqual(obj.declarationRefs, ["dec_1"]);
});

// ── narrowing ripple: a remapped record stays whole through A2 ───────────────────

test("ripple: a matching→stand remapped record resolves by the SAME record_id (receiptRefs attached)", () => {
  // rec-minato-darkroom-time was matching+offered in A1; the narrowing remapped it
  // to stand+offered. A2 references listings by record_id only, so the surface
  // change must not break the chain — the declaration attaches and resolves under
  // the same id, with the receiptRef still present (the "preserve" path goes
  // through an actually-remapped record, not an untouched one).
  const remapped = SEED_BOARD_RECORDS.find((r) => r.recordId === "rec-minato-darkroom-time");
  assert.ok(remapped, "the remapped record must exist");
  assert.equal(remapped!.surfaceShape, "stand"); // remapped, no longer matching

  const plan = planDeclaration({
    listingRecordId: remapped!.recordId,
    ownerHandle: remapped!.ownerHandle,
    ownerPublicRef: remapped!.ownerPublicRef,
    kind: "handoff",
    currentReceiptRefs: [],
    ids: { declarationId: "dec_r", declEventId: "evt_d", attachEventId: "evt_a" },
    at: "2026-05-31T00:00:00Z",
  });
  assert.deepEqual(plan.newReceiptRefs, ["dec_r"]); // attached on the remapped record

  const obj = buildTransactionObject(remapped!.recordId, plan.events);
  assert.equal(obj.listingRecordId, "rec-minato-darkroom-time"); // same id resolves
  assert.deepEqual(obj.declarationRefs, ["dec_r"]); // receiptRef survives the remap
});

// ── A2-impl-8 + boundary compatibility ──────────────────────────────────────────

test("A2-impl-8: transaction object + declaration both stamp the A2 boundary", () => {
  const obj = buildTransactionObject("rec-x", []);
  const dec = toPublicDeclaration({
    declarationId: "dec_1",
    listingRecordId: "rec-x",
    ownerPublicRef: "Alice · alice.example",
    kind: "handoff",
    createdAt: "t",
  });
  for (const b of [obj.machineReadableBoundary, dec.machineReadableBoundary]) {
    assert.equal(b.pxDoesNotSell, true);
    assert.equal(b.pxDoesNotSettle, true);
    assert.equal(b.pxDoesNotRecommend, true);
    assert.equal(b.ownerControlsAction, true);
    assert.equal(b.pxDoesNotHoldMessageBody, true);
  }
});

test("A1 listing boundary stays byte-compatible (no new key added)", () => {
  assert.ok(!("pxDoesNotHoldMessageBody" in MACHINE_READABLE_BOUNDARY));
  assert.deepEqual(Object.keys(MACHINE_READABLE_BOUNDARY).sort(), [
    "ownerControlsAction",
    "pxDoesNotRecommend",
    "pxDoesNotSell",
    "pxDoesNotSettle",
  ]);
  // The A2 boundary is a strict superset.
  assert.equal(TRANSACTION_BOUNDARY.pxDoesNotHoldMessageBody, true);
});
