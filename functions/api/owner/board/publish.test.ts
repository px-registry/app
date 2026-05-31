// Integration tests for POST /api/owner/board/publish. `node --test`.
//
// Drives the real handler against a stateful fake D1, a fake AUTH KV, and a real
// signed session. Proves the first owner-write's security surface end to end:
// CSRF/Origin guard, signed-session requirement, server-minted record_id,
// server-derived owner_public_ref, body identity ignored, publication_state public,
// canonical reject, and the boundary stamped on the response (owner_handle never out).

import { test } from "node:test";
import assert from "node:assert/strict";

import * as publishModule from "./publish.ts";
import { onRequestPost } from "./publish.ts";
import { createSessionToken, SESSION_COOKIE } from "../../../_auth.ts";

const AUTH_SECRET = "test-secret-OBP";
const ALLOWED_ORIGIN = "https://app.px-registry.org";

const BODY = {
  boardTitle: "Aoi Bonsai — spring stand",
  rows: [
    { surfaceShape: "stand", intent: "wanted", title: "Looking for shohin pots" },
    { surfaceShape: "offered", intent: "offered", title: "Spare moss for trade" },
  ],
  contact: { kind: "public_external_link", externalActionUrl: "https://aoi.example/contact" },
};

// Stateful fake D1: captures INSERTs into an in-memory rows array (positional args
// mirror the explicit INSERT column list in _ownerboard.ts).
function fakeD1() {
  const state = { records: [] as Array<Record<string, unknown>> };
  function apply(sql: string, args: unknown[]) {
    if (/INSERT INTO board_records/.test(sql)) {
      state.records.push({
        record_id: args[0], owner_handle: args[1], owner_public_ref: args[2],
        surface_shape: args[3], intent: args[4], category: args[5], region: args[6],
        title: args[7], summary: args[8], media_refs: args[9], external_action_url: args[10],
        evidence_refs: args[11], receipt_refs: args[12], created_at: args[13],
        updated_at: args[14], publication_state: args[15],
      });
    }
  }
  function makeStmt(sql: string) {
    let bound: unknown[] = [];
    const stmt = {
      bind(...a: unknown[]) { bound = a; return stmt; },
      async run() { apply(sql, bound); return { success: true }; },
    };
    return stmt;
  }
  return {
    _state: state,
    prepare: (sql: string) => makeStmt(sql),
    async batch(stmts: Array<{ run: () => Promise<unknown> }>) { for (const s of stmts) await s.run(); return []; },
  };
}

function fakeAuth(owner: Record<string, unknown> | null) {
  return { async get() { return owner; } };
}

async function postPublish(
  db: ReturnType<typeof fakeD1>,
  body: unknown,
  opts: { handle?: string; origin?: string | null; owner?: Record<string, unknown> | null } = {},
) {
  const env = { BOARD: db, AUTH: fakeAuth(opts.owner ?? null), AUTH_SECRET } as never;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const origin = opts.origin === undefined ? ALLOWED_ORIGIN : opts.origin;
  if (origin) headers["Origin"] = origin;
  if (opts.handle) {
    const token = await createSessionToken({ AUTH_SECRET } as never, opts.handle);
    headers["Cookie"] = `${SESSION_COOKIE}=${token}`;
  }
  const request = new Request("https://app.px-registry.org/api/owner/board/publish", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  return onRequestPost({ request, env } as never);
}

test("OBP-impl-10 (CSRF): a missing or foreign Origin is rejected 403, even with a valid session", async () => {
  const missing = await postPublish(fakeD1(), BODY, { handle: "aoi-bonsai", origin: null });
  assert.equal(missing.status, 403);
  const foreign = await postPublish(fakeD1(), BODY, { handle: "aoi-bonsai", origin: "https://evil.example" });
  assert.equal(foreign.status, 403);
});

test("OBP-impl-11 (auth): allowed origin but no session → 401, nothing written", async () => {
  const db = fakeD1();
  const res = await postPublish(db, BODY, {});
  assert.equal(res.status, 401);
  assert.equal(db._state.records.length, 0);
});

test("OBP-impl-12: owner publishes → 201, rows minted public; boundary stamped, owner_handle never returned", async () => {
  const db = fakeD1();
  const res = await postPublish(db, BODY, { handle: "aoi-bonsai", owner: { handle: "aoi-bonsai", display_name: "Aoi Bonsai" } });
  assert.equal(res.status, 201);
  const out = await res.json();
  assert.equal(out.ok, true);
  assert.equal(out.count, 2);

  // Stored rows: server-minted ids, session handle, derived public ref, public state.
  assert.equal(db._state.records.length, 2);
  for (const r of db._state.records) {
    assert.match(String(r.record_id), /^rec_/); // server-minted (req 12)
    assert.equal(r.owner_handle, "aoi-bonsai"); // from session, not body
    assert.equal(r.owner_public_ref, "Aoi Bonsai"); // server-derived (req 18)
    assert.equal(r.publication_state, "public");
    assert.equal(r.media_refs, null); // out-of-scope column untouched
  }
  // Response records are public projections.
  for (const rec of out.records) {
    assert.match(rec.recordId, /^rec_/);
    assert.ok(!("ownerHandle" in rec)); // private never returned (9A-8)
    assert.equal(rec.machineReadableBoundary.pxDoesNotSell, true);
    assert.equal(rec.externalActionUrl, "https://aoi.example/contact");
  }
});

test("OBP-impl-13: body-provided owner_handle / owner_public_ref / record_id are ignored", async () => {
  const db = fakeD1();
  const spoof = {
    ...BODY,
    owner_handle: "mallory",
    owner_public_ref: "Spoofed Ref",
    record_id: "rec-victim",
    rows: [{ surfaceShape: "stand", intent: "wanted", title: "ok", record_id: "rec-row-victim" }],
  };
  await postPublish(db, spoof, { handle: "aoi-bonsai", owner: { handle: "aoi-bonsai", display_name: "Aoi Bonsai" } });
  const r = db._state.records[0];
  assert.equal(r.owner_handle, "aoi-bonsai");
  assert.equal(r.owner_public_ref, "Aoi Bonsai");
  assert.match(String(r.record_id), /^rec_/);
  const dump = JSON.stringify(db._state.records);
  for (const leaked of ["mallory", "Spoofed Ref", "rec-victim", "rec-row-victim"]) {
    assert.ok(!dump.includes(leaked), `must not store ${leaked}`);
  }
});

test("OBP-impl-14: owner_public_ref falls back to the handle when there is no display_name", async () => {
  const db = fakeD1();
  await postPublish(db, BODY, { handle: "aoi-bonsai", owner: null });
  assert.equal(db._state.records[0].owner_public_ref, "aoi-bonsai");
});

test("OBP-impl-15: a non-canonical row is rejected 400, nothing written", async () => {
  const db = fakeD1();
  const res = await postPublish(
    db,
    { ...BODY, rows: [{ surfaceShape: "matching", intent: "wanted", title: "x" }] },
    { handle: "aoi-bonsai", owner: null },
  );
  assert.equal(res.status, 400);
  assert.equal(db._state.records.length, 0);
});

test("OBP-impl-16: no GET handler is exported — a mutation cannot ride a GET", () => {
  assert.equal(typeof onRequestPost, "function");
  assert.equal((publishModule as Record<string, unknown>).onRequestGet, undefined);
});

test("OBP-UI-impl-3: the response returns a localRowId → recordId reconciliation mapping", async () => {
  const db = fakeD1();
  const body = {
    ...BODY,
    rows: [
      { surfaceShape: "stand", intent: "wanted", title: "A", localRowId: "row_aaa" },
      { surfaceShape: "offered", intent: "offered", title: "B", localRowId: "row_bbb" },
    ],
  };
  const res = await postPublish(db, body, { handle: "aoi-bonsai", owner: null });
  assert.equal(res.status, 201);
  const out = await res.json();
  assert.equal(out.published.length, 2);
  // Each entry pairs the client's localRowId with a server-minted recordId.
  const byLocal = new Map(out.published.map((p: { localRowId: string; recordId: string }) => [p.localRowId, p.recordId]));
  assert.match(byLocal.get("row_aaa"), /^rec_/);
  assert.match(byLocal.get("row_bbb"), /^rec_/);
  assert.notEqual(byLocal.get("row_aaa"), byLocal.get("row_bbb"));
});

test("OBP-UI-impl-4 (leak): localRowId is never stored in D1 nor present in any public record", async () => {
  const db = fakeD1();
  const body = {
    ...BODY,
    rows: [{ surfaceShape: "stand", intent: "wanted", title: "A", localRowId: "row_SECRET_LOCAL" }],
  };
  const res = await postPublish(db, body, { handle: "aoi-bonsai", owner: null });
  const out = await res.json();
  // Not in the stored row (never bound to a column).
  assert.ok(!JSON.stringify(db._state.records).includes("row_SECRET_LOCAL"));
  // Not in any public record returned.
  assert.ok(!JSON.stringify(out.records).includes("row_SECRET_LOCAL"));
  for (const rec of out.records) assert.ok(!("localRowId" in rec));
  // It appears ONLY in the reconciliation mapping (the owner's own echo).
  assert.equal(out.published[0].localRowId, "row_SECRET_LOCAL");
});
