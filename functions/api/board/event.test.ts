// Integration tests for POST /api/board/event + the read helpers. `node --test`.
//
// Drives the real handler against a stateful fake D1 and a real signed session.
// Proves: owner-only writes (401/403), the chain fills (contact → handoff →
// declaration → receiptRefs), handoff rejects unsafe URLs, declarations never
// expose owner_handle, and every response carries the transaction boundary.

import { test } from "node:test";
import assert from "node:assert/strict";

import { onRequestPost } from "./event.ts";
import { readTransaction, resolveContactUrl } from "../../_transaction.ts";
import { createSessionToken, SESSION_COOKIE } from "../../_auth.ts";

const AUTH_SECRET = "test-secret-A2";

// A small stateful fake D1: in-memory tables, dispatch by SQL substring.
function fakeD1(boardRow: {
  owner_handle: string;
  owner_public_ref: string;
  external_action_url?: string | null;
  receipt_refs?: string;
}) {
  const state = {
    board: { receipt_refs: "[]", external_action_url: null as string | null, ...boardRow },
    events: [] as Array<Record<string, unknown>>,
    declarations: [] as Array<Record<string, unknown>>,
  };
  function apply(sql: string, args: unknown[]) {
    if (/INSERT INTO transaction_events/.test(sql)) {
      state.events.push({ event_id: args[0], listing_record_id: args[1], kind: args[2], ref: args[3], created_at: args[4] });
    } else if (/INSERT INTO declarations/.test(sql)) {
      state.declarations.push({ declaration_id: args[0], owner_handle: args[1], listing_record_id: args[2], owner_public_ref: args[3], kind: args[4], created_at: args[5] });
    } else if (/UPDATE board_records SET receipt_refs/.test(sql)) {
      state.board.receipt_refs = args[0] as string;
    }
  }
  function makeStmt(sql: string) {
    let bound: unknown[] = [];
    const stmt = {
      bind(...a: unknown[]) {
        bound = a;
        return stmt;
      },
      async run() {
        apply(sql, bound);
        return { success: true };
      },
      async first<T>() {
        if (/owner_handle, owner_public_ref/.test(sql)) {
          return { owner_handle: state.board.owner_handle, owner_public_ref: state.board.owner_public_ref } as T;
        }
        if (/receipt_refs FROM board_records/.test(sql)) {
          return { receipt_refs: state.board.receipt_refs } as T;
        }
        if (/external_action_url FROM board_records/.test(sql)) {
          return { external_action_url: state.board.external_action_url } as T;
        }
        return null;
      },
      async all<T>() {
        if (/FROM transaction_events/.test(sql)) return { results: state.events as T[] };
        if (/FROM declarations/.test(sql)) {
          // Mirror the real explicit-column SELECT: owner_handle is NOT returned.
          const pub = state.declarations.map(({ owner_handle: _omit, ...rest }) => rest);
          return { results: pub as T[] };
        }
        return { results: [] as T[] };
      },
    };
    return stmt;
  }
  return {
    _state: state,
    prepare: (sql: string) => makeStmt(sql),
    async batch(stmts: Array<{ run: () => Promise<unknown> }>) {
      for (const s of stmts) await s.run();
      return [];
    },
  };
}

async function postEvent(db: ReturnType<typeof fakeD1>, body: object, handle?: string) {
  const env = { BOARD: db, AUTH: {}, AUTH_SECRET } as never;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (handle) {
    const token = await createSessionToken({ AUTH_SECRET } as never, handle);
    headers["Cookie"] = `${SESSION_COOKIE}=${token}`;
  }
  const request = new Request("https://app.px-registry.org/api/board/event", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  return onRequestPost({ request, env } as never);
}

test("A2-impl-6 (auth): no session → 401", async () => {
  const db = fakeD1({ owner_handle: "alice", owner_public_ref: "Alice · alice.example" });
  const res = await postEvent(db, { recordId: "rec-x", kind: "contact_opened" });
  assert.equal(res.status, 401);
});

test("ownership: signed in but not the owner → 403", async () => {
  const db = fakeD1({ owner_handle: "alice", owner_public_ref: "Alice · alice.example" });
  const res = await postEvent(db, { recordId: "rec-x", kind: "contact_opened" }, "mallory");
  assert.equal(res.status, 403);
});

test("A2-impl-1/8: owner records contact_opened; response carries the boundary", async () => {
  const db = fakeD1({ owner_handle: "alice", owner_public_ref: "Alice · alice.example" });
  const res = await postEvent(db, { recordId: "rec-x", kind: "contact_opened" }, "alice");
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.event.kind, "contact_opened");
  assert.equal(body.event.ref, null);
  assert.equal(body.machineReadableBoundary.pxDoesNotHoldMessageBody, true);
  assert.equal(body.machineReadableBoundary.pxDoesNotSettle, true);
  assert.equal(db._state.events.length, 1);
});

test("A2-impl-2: handoff draft accepts a safe owner URL, rejects unsafe", async () => {
  const db = fakeD1({ owner_handle: "alice", owner_public_ref: "Alice · alice.example" });
  const ok = await postEvent(db, { recordId: "rec-x", kind: "handoff_draft_created", actionUrl: "https://alice.example/handoff" }, "alice");
  assert.equal(ok.status, 200);
  assert.equal((await ok.json()).event.ref, "https://alice.example/handoff");

  const bad = await postEvent(db, { recordId: "rec-x", kind: "handoff_draft_created", actionUrl: "javascript:alert(1)" }, "alice");
  assert.equal(bad.status, 400);
  // The unsafe URL was never written.
  assert.ok(!db._state.events.some((e) => String(e.ref).includes("javascript:")));
});

test("A2-impl-3/4: declaration mints an id, records two events, fills receiptRefs", async () => {
  const db = fakeD1({ owner_handle: "alice", owner_public_ref: "Alice · alice.example" });
  const res = await postEvent(db, { recordId: "rec-x", kind: "owner_declaration_created", declarationKind: "handoff" }, "alice");
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.match(body.declaration.declarationId, /^dec_/);
  assert.equal(body.declaration.kind, "handoff");
  assert.ok(!("ownerHandle" in body.declaration)); // private never returned

  // chain: owner_declaration_created + receipt_ref_attached
  const kinds = db._state.events.map((e) => e.kind);
  assert.deepEqual(kinds, ["owner_declaration_created", "receipt_ref_attached"]);
  // receiptRefs on the listing now include the declaration id.
  assert.deepEqual(JSON.parse(db._state.board.receipt_refs), [body.declaration.declarationId]);

  // readTransaction surfaces the chain + public declaration (no owner_handle).
  const { object, declarations } = await readTransaction(db as never, "rec-x");
  assert.deepEqual(object.declarationRefs, [body.declaration.declarationId]);
  assert.equal(declarations.length, 1);
  assert.ok(!("ownerHandle" in declarations[0]));
  assert.equal(object.machineReadableBoundary.pxDoesNotHoldMessageBody, true);
});

test("receipt_refs is APPENDED, not overwritten — two declarations both persist", async () => {
  const db = fakeD1({ owner_handle: "alice", owner_public_ref: "Alice · alice.example" });
  const r1 = await (await postEvent(db, { recordId: "rec-x", kind: "owner_declaration_created", declarationKind: "handoff" }, "alice")).json();
  const r2 = await (await postEvent(db, { recordId: "rec-x", kind: "owner_declaration_created", declarationKind: "exchange" }, "alice")).json();

  const id1 = r1.declaration.declarationId;
  const id2 = r2.declaration.declarationId;
  assert.notEqual(id1, id2);

  // Both opaque ids survive in the listing's receipt_refs (append, no clobber).
  assert.deepEqual(JSON.parse(db._state.board.receipt_refs), [id1, id2]);

  // The assembled chain reflects both declarations.
  const { object, declarations } = await readTransaction(db as never, "rec-x");
  assert.deepEqual(object.declarationRefs, [id1, id2]);
  assert.equal(declarations.length, 2);
  // Four chain events total: 2× (owner_declaration_created + receipt_ref_attached).
  assert.equal(db._state.events.filter((e) => e.kind === "receipt_ref_attached").length, 2);
});

test("A2-impl-5: the request body carries no message/PII fields that get stored", async () => {
  // Even if a caller smuggles extra fields, nothing but kind/url/declarationKind
  // is read, and the events table has no body/PII columns to hold them.
  const db = fakeD1({ owner_handle: "alice", owner_public_ref: "Alice · alice.example" });
  await postEvent(
    db,
    { recordId: "rec-x", kind: "contact_opened", message: "my phone is 555", email: "a@b.com", counterpartyName: "Bob" },
    "alice",
  );
  const stored = JSON.stringify(db._state.events);
  assert.ok(!stored.includes("555"));
  assert.ok(!stored.includes("a@b.com"));
  assert.ok(!stored.includes("Bob"));
});

test("resolveContactUrl returns the listing's sanitized owner contact", async () => {
  const db = fakeD1({ owner_handle: "alice", owner_public_ref: "Alice · alice.example", external_action_url: "https://alice.example/contact" });
  assert.equal(await resolveContactUrl(db as never, "rec-x"), "https://alice.example/contact");

  const evil = fakeD1({ owner_handle: "alice", owner_public_ref: "Alice", external_action_url: "javascript:alert(1)" });
  assert.equal(await resolveContactUrl(evil as never, "rec-x"), null);
});
