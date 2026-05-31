// Unit tests for the public read filter in _board.ts. `node --test`.
//
// queryBoard now asks D1 for public rows only (WHERE publication_state =
// 'public'). This proves two things: the query CARRIES that clause (white-box,
// captured from prepare()), and given a D1 that honors it, a retired row is hidden
// — it never reaches /search, /board, or /proposals (all read through queryBoard).

import { test } from "node:test";
import assert from "node:assert/strict";

import { queryBoard } from "./_board.ts";

// A raw public row in the snake_case shape the SELECT returns. publication_state
// is carried so the fake can apply the WHERE; the real SELECT does not project it.
function rawRow(id: string, publication_state: string) {
  return {
    record_id: id,
    owner_public_ref: "Aoi Bonsai · aoi-bonsai.example",
    surface_shape: "stand",
    intent: "wanted",
    category: null,
    region: null,
    title: `row ${id}`,
    summary: null,
    media_refs: "[]",
    external_action_url: null,
    evidence_refs: "[]",
    receipt_refs: "[]",
    created_at: "2026-05-30T00:00:00.000Z",
    updated_at: "2026-05-30T00:00:00.000Z",
    publication_state,
  };
}

// Fake D1 that records the SQL and, when it contains the public filter, returns
// only public rows — exactly what real D1 does for the WHERE clause.
function filteringD1(rows: Array<ReturnType<typeof rawRow>>) {
  const captured: string[] = [];
  return {
    _sql: captured,
    prepare(sql: string) {
      captured.push(sql);
      return {
        bind() { return this; },
        async all() {
          const filtered = /publication_state\s*=\s*'public'/.test(sql)
            ? rows.filter((r) => r.publication_state === "public")
            : rows;
          return { results: filtered, success: true, meta: {} };
        },
      };
    },
  };
}

test("OBP-impl-24: queryBoard asks D1 for public rows only (the WHERE clause is present)", async () => {
  const db = filteringD1([rawRow("rec-pub", "public")]);
  await queryBoard(db as never, new URL("https://app.px-registry.org/api/search"));
  assert.ok(db._sql.some((s) => /WHERE publication_state = 'public'/.test(s)), "the SELECT must filter on publication_state");
});

test("OBP-impl-25: a retired row is hidden from the public read", async () => {
  const db = filteringD1([rawRow("rec-pub", "public"), rawRow("rec-retired", "retired")]);
  const result = await queryBoard(db as never, new URL("https://app.px-registry.org/api/search"));
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const ids = result.records.map((r) => r.recordId);
  assert.deepEqual(ids, ["rec-pub"]);
  assert.ok(!ids.includes("rec-retired"));
});
