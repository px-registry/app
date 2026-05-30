// Tests for owner-side saved_filter application. Run with `node --test`.
//
// The filter becomes EXPLICIT neutral /search params — the owner's client passes
// them; the server reads no memory. This is the owner-side half of (neutral
// board) × (owner-local memory).

import { test } from "node:test";
import assert from "node:assert/strict";

import { savedFilterToSearchParams, savedFilterToSearchPath } from "./index.ts";

test("a saved filter maps to explicit, neutral /search params", () => {
  const sp = savedFilterToSearchParams({
    surfaceShape: "auction_like",
    intent: "wanted",
    category: "matching",
    region: "Kyoto",
    query: "press",
  });
  assert.equal(sp.get("surface_shape"), "auction_like");
  assert.equal(sp.get("intent"), "wanted");
  assert.equal(sp.get("category"), "matching");
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
