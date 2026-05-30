// Integration tests for GET /api/search. Run with `node --test`.
//
// Drives the real Function handler against a fake D1 that returns the canonical
// seed as raw rows — proving the route exists (9A-1) and that GET /search returns
// D1-backed public records (9A-2), end to end through _board.ts's mapping.

import { test } from "node:test";
import assert from "node:assert/strict";

import { onRequestGet } from "./search.ts";
import { SEED_BOARD_RECORDS } from "../../lib/board/index.ts";

// Seed rows in the raw, snake_case, JSON-as-text shape the PUBLIC-column SELECT
// returns. owner_handle is deliberately absent — the query never fetches it, so
// the fake D1 mirrors that (the private column never leaves the database).
const RAW_ROWS = SEED_BOARD_RECORDS.map((r) => ({
  record_id: r.recordId,
  owner_public_ref: r.ownerPublicRef,
  surface_shape: r.surfaceShape,
  intent: r.intent,
  category: r.category ?? null,
  region: r.region ?? null,
  title: r.title,
  summary: r.summary ?? null,
  media_refs: JSON.stringify(r.mediaRefs ?? []),
  external_action_url: r.externalActionUrl ?? null,
  evidence_refs: JSON.stringify(r.evidenceRefs ?? []),
  receipt_refs: JSON.stringify(r.receiptRefs ?? []),
  created_at: r.createdAt,
  updated_at: r.updatedAt,
}));

// Minimal D1 stand-in: prepare().all() yields the raw rows. (queryBoard does the
// filtering in JS at A1 scale, so the fake need not interpret SQL.)
function fakeD1(rows = RAW_ROWS) {
  return {
    prepare() {
      return {
        bind() {
          return this;
        },
        async all() {
          return { results: rows, success: true, meta: {} };
        },
      };
    },
  };
}

function call(query: string, db = fakeD1()) {
  const request = new Request(`https://app.px-registry.org/api/search${query}`);
  // The Pages context carries more fields; the handler only reads request + env.
  return onRequestGet({ request, env: { BOARD: db } } as never);
}

test("9A-1: the /api/search route handler exists", () => {
  assert.equal(typeof onRequestGet, "function");
});

test("9A-2: GET /search returns D1-backed public records", async () => {
  const res = await call("");
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.count, SEED_BOARD_RECORDS.length);
  assert.equal(body.records.length, SEED_BOARD_RECORDS.length);

  const first = body.records[0];
  assert.equal(typeof first.recordId, "string");
  assert.ok("ownerPublicRef" in first);
  assert.ok(!("ownerHandle" in first)); // private field never served (9A-8)
  assert.equal(first.machineReadableBoundary.pxDoesNotSell, true); // boundary stamped (9A-12)
});

test("GET /search honors the canonical surface_shape filter", async () => {
  const res = await call("?surface_shape=auction_like");
  const body = await res.json();
  assert.ok(body.count > 0);
  assert.ok(body.records.every((r: { surfaceShape: string }) => r.surfaceShape === "auction_like"));
});

test("GET /search rejects a non-canonical filter with an explicit 400 (§6)", async () => {
  for (const q of ["?surface_shape=auction", "?surface_shape=matching", "?intent=buy"]) {
    const res = await call(q);
    assert.equal(res.status, 400, `${q} must be 400`);
    const body = await res.json();
    assert.equal(body.count, 0);
    assert.equal(body.error, "invalid_canonical");
  }
});

test("GET /search?recordId= returns exactly one record (detail surface)", async () => {
  const res = await call("?recordId=rec-ito-notebook-edition");
  const body = await res.json();
  assert.equal(body.count, 1);
  assert.equal(body.records[0].recordId, "rec-ito-notebook-edition");
});

test("an unsafe externalActionUrl from D1 is sanitized out of the response (§4)", async () => {
  const evilRows = [
    { ...RAW_ROWS[0], record_id: "rec-evil", external_action_url: "javascript:alert(1)" },
  ];
  const res = await call("?recordId=rec-evil", fakeD1(evilRows));
  const body = await res.json();
  assert.equal(body.count, 1);
  assert.ok(!("externalActionUrl" in body.records[0]), "unsafe URL must not be served");
  assert.ok(!JSON.stringify(body).includes("javascript:"));
});

test("B-impl-3: same params → byte-identical /search regardless of which owner asks", async () => {
  // Memory-blindness: the board is one neutral surface. Two different sessions,
  // same query → identical response bytes (the handler never reads the cookie).
  const make = (cookie: string) =>
    onRequestGet({
      request: new Request("https://app.px-registry.org/api/search?surface_shape=stand", {
        headers: { Cookie: cookie },
      }),
      env: { BOARD: fakeD1() },
    } as never);
  const a = await (await make("__px_session=ownerA")).text();
  const b = await (await make("__px_session=ownerB")).text();
  assert.equal(a, b);
});

test("a D1 failure fails closed — no rows, no leaked error detail", async () => {
  const brokenDb = {
    prepare() {
      return {
        bind() {
          return this;
        },
        async all() {
          throw new Error("boom: internal connection string xyz");
        },
      };
    },
  };
  const res = await call("", brokenDb);
  assert.equal(res.status, 500);
  const body = await res.json();
  assert.deepEqual(body.records, []);
  assert.ok(!JSON.stringify(body).includes("boom"));
});
