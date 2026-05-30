// Tests for transaction events (the record chain). Run with `node --test`.
//
// Event vocabulary is fixed and non-judgment; the boundary extends A1's with the
// message-body claim; assembly is pure (ordered, declarationRefs derived).

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  TRANSACTION_EVENT_KINDS,
  isTransactionEventKind,
  TRANSACTION_BOUNDARY,
  buildTransactionObject,
  planContactOpened,
  planHandoffDraft,
  MACHINE_READABLE_BOUNDARY,
  type TransactionEventV1,
} from "./index.ts";

test("event kinds are exactly the four non-judgment values (no status kind)", () => {
  assert.deepEqual(
    [...TRANSACTION_EVENT_KINDS],
    ["contact_opened", "handoff_draft_created", "owner_declaration_created", "receipt_ref_attached"],
  );
  for (const bad of ["completed", "settled", "paid", "successful", "safe", "成立"]) {
    assert.ok(!isTransactionEventKind(bad), `must reject status kind "${bad}"`);
  }
});

test("the transaction boundary extends A1's with pxDoesNotHoldMessageBody (frozen)", () => {
  assert.deepEqual(TRANSACTION_BOUNDARY, {
    ...MACHINE_READABLE_BOUNDARY,
    pxDoesNotHoldMessageBody: true,
  });
  assert.equal(TRANSACTION_BOUNDARY.pxDoesNotHoldMessageBody, true);
  assert.ok(Object.isFrozen(TRANSACTION_BOUNDARY));
});

test("planContactOpened records a fact only — no body, no PII, no ref", () => {
  const e = planContactOpened({ listingRecordId: "rec-x", eventId: "evt_1", at: "2026-05-30T00:00:00Z" });
  assert.equal(e.kind, "contact_opened");
  assert.equal(e.ref, null);
  assert.deepEqual(Object.keys(e).sort(), ["at", "eventId", "kind", "listingRecordId", "ref"]);
});

test("planHandoffDraft takes a safe owner URL and rejects unsafe ones", () => {
  const e = planHandoffDraft({
    listingRecordId: "rec-x",
    actionUrl: "https://owner.example/handoff",
    eventId: "evt_2",
    at: "2026-05-30T00:00:00Z",
  });
  assert.equal(e.kind, "handoff_draft_created");
  assert.equal(e.ref, "https://owner.example/handoff");

  for (const bad of ["javascript:alert(1)", "data:text/html,x", "/relative", "file:///x"]) {
    assert.throws(
      () => planHandoffDraft({ listingRecordId: "rec-x", actionUrl: bad, eventId: "e", at: "t" }),
      /safe http\/https/,
    );
  }
});

test("buildTransactionObject orders events and derives declarationRefs", () => {
  const events: TransactionEventV1[] = [
    { eventId: "evt_c", listingRecordId: "rec-x", kind: "receipt_ref_attached", ref: "dec_2", at: "2026-05-30T03:00:00Z" },
    { eventId: "evt_a", listingRecordId: "rec-x", kind: "contact_opened", ref: null, at: "2026-05-30T01:00:00Z" },
    { eventId: "evt_b", listingRecordId: "rec-x", kind: "owner_declaration_created", ref: "dec_2", at: "2026-05-30T02:00:00Z" },
    { eventId: "evt_z", listingRecordId: "rec-OTHER", kind: "contact_opened", ref: null, at: "2026-05-30T00:00:00Z" },
  ];
  const obj = buildTransactionObject("rec-x", events);
  assert.deepEqual(obj.events.map((e) => e.eventId), ["evt_a", "evt_b", "evt_c"]); // ordered, other listing excluded
  assert.deepEqual(obj.declarationRefs, ["dec_2"]); // from receipt_ref_attached
  assert.equal(obj.machineReadableBoundary.pxDoesNotHoldMessageBody, true);
  assert.equal(obj.machineReadableBoundary.pxDoesNotSell, true);
});

test("declarationRefs dedupe and ignore non-attach events", () => {
  const events: TransactionEventV1[] = [
    { eventId: "e1", listingRecordId: "r", kind: "receipt_ref_attached", ref: "dec_1", at: "t1" },
    { eventId: "e2", listingRecordId: "r", kind: "receipt_ref_attached", ref: "dec_1", at: "t2" },
    { eventId: "e3", listingRecordId: "r", kind: "owner_declaration_created", ref: "dec_1", at: "t3" },
  ];
  assert.deepEqual(buildTransactionObject("r", events).declarationRefs, ["dec_1"]);
});
