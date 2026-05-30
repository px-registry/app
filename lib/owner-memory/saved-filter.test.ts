// Tests for owner-side saved_filter application. Run with `node --test`.
//
// The filter becomes EXPLICIT neutral /search params — the owner's client passes
// them; the server reads no memory. This is the owner-side half of (neutral
// board) × (owner-local memory).

import { test } from "node:test";
import assert from "node:assert/strict";

import { savedFilterToSearchParams, savedFilterToSearchPath, isApplicableSavedFilter } from "./index.ts";

test("a saved filter maps to explicit, neutral /search params", () => {
  const sp = savedFilterToSearchParams({
    surfaceShape: "auction_like",
    intent: "wanted",
    category: "sale",
    region: "Kyoto",
    query: "press",
  });
  assert.equal(sp.get("surface_shape"), "auction_like");
  assert.equal(sp.get("intent"), "wanted");
  assert.equal(sp.get("category"), "sale");
  assert.equal(sp.get("region"), "Kyoto");
  assert.equal(sp.get("q"), "press");
});

test("an empty filter yields no params (the whole neutral board)", () => {
  assert.equal(savedFilterToSearchParams({}).toString(), "");
  assert.equal(savedFilterToSearchPath({}), "/search/");
});

test("the path is the neutral board with explicit query", () => {
  const path = savedFilterToSearchPath({ surfaceShape: "stand" });
  assert.equal(path, "/search/?surface_shape=stand");
});

test("Option B: a stale 'matching' saved_filter is invalid and never applied", () => {
  // A filter stored before the narrowing carries surfaceShape="matching" at
  // runtime. It is marked invalid (excluded from apply) and never emits a param.
  const stale = { surfaceShape: "matching" } as never;
  assert.equal(isApplicableSavedFilter(stale), false);
  assert.equal(savedFilterToSearchParams(stale).toString(), ""); // matching dropped, not emitted
  // A canonical filter stays applicable.
  assert.equal(isApplicableSavedFilter({ surfaceShape: "stand", category: "sale" }), true);
});
