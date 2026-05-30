// Tests for board search/filter (pure). Run with `node --test`.
//
// Filters narrow and never widen; a non-canonical filter fails closed; sort is
// strictly the user-selected createdAt direction with no hidden signal.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  parseSearchParams,
  filterBoard,
  SEED_BOARD_RECORDS,
  type PublicBoardRow,
} from "./index.ts";

function search(query: string): PublicBoardRow[] {
  const params = parseSearchParams(new URLSearchParams(query));
  return filterBoard(SEED_BOARD_RECORDS, params);
}

test("no params returns every seed row", () => {
  assert.equal(search("").length, SEED_BOARD_RECORDS.length);
});

test("surface_shape filter narrows to that shape only", () => {
  for (const shape of ["offered", "auction_like", "stand"] as const) {
    const rows = search(`surface_shape=${shape}`);
    assert.ok(rows.length > 0, `expected at least one ${shape} row`);
    assert.ok(rows.every((r) => r.surfaceShape === shape));
  }
});

test("intent filter narrows to that intent only", () => {
  for (const intent of ["wanted", "offered", "ask"] as const) {
    const rows = search(`intent=${intent}`);
    assert.ok(rows.length > 0, `expected at least one intent=${intent} row`);
    assert.ok(rows.every((r) => r.intent === intent));
  }
});

test("surface_shape and intent compose (independent axes)", () => {
  // stand now carries the wanted intent (the remapped letterpress-operator row) —
  // the "meeting" working the matching surface used to hold.
  const rows = search("surface_shape=stand&intent=wanted");
  assert.ok(rows.length > 0);
  assert.ok(rows.every((r) => r.surfaceShape === "stand" && r.intent === "wanted"));
});

test("a non-canonical surface_shape fails closed (zero rows, never all)", () => {
  assert.equal(search("surface_shape=auction").length, 0);
  assert.equal(search("surface_shape=sale").length, 0);
  assert.equal(search("surface_shape=matching").length, 0); // narrowed out
  assert.equal(search("intent=offer").length, 0);
});

test("free-text q matches title/summary case-insensitively", () => {
  const rows = search("q=letterpress");
  assert.ok(rows.length > 0);
  assert.ok(rows.every((r) => `${r.title} ${r.summary ?? ""}`.toLowerCase().includes("letterpress")));
});

test("recordId selects exactly one row (powers the detail surface)", () => {
  const rows = search("recordId=rec-ito-notebook-edition");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].recordId, "rec-ito-notebook-edition");
});

test("category and region narrow", () => {
  const sale = search("category=sale");
  assert.ok(sale.length > 0);
  assert.ok(sale.every((r) => r.category === "sale"));
  const kyoto = search("region=Kyoto");
  assert.ok(kyoto.length > 0);
  assert.ok(kyoto.every((r) => r.region === "Kyoto"));
});

test("sort is user-selected createdAt only — no hidden ranking (9A-10)", () => {
  const newest = search("sort=newest");
  const oldest = search("sort=oldest");

  // newest is the exact reverse-chronological order; oldest its mirror. The
  // order is a pure function of createdAt (+recordId tie-break) — nothing else.
  const byNewest = [...SEED_BOARD_RECORDS].sort(
    (a, b) => b.createdAt.localeCompare(a.createdAt) || b.recordId.localeCompare(a.recordId),
  );
  assert.deepEqual(newest.map((r) => r.recordId), byNewest.map((r) => r.recordId));
  assert.deepEqual(oldest.map((r) => r.recordId), [...byNewest].reverse().map((r) => r.recordId));
});

test("default sort is newest", () => {
  assert.deepEqual(
    search("").map((r) => r.recordId),
    search("sort=newest").map((r) => r.recordId),
  );
});
