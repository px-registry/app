// Tests for the board canonical vocabulary. Run with `node --test`.
//
// The closed road, pinned: surface_shape is exactly 4, intent exactly 3, the
// guards reject everything else, and the machine-readable boundary is all-true
// and frozen. These are the invariants the whole spine leans on.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  SURFACE_SHAPES,
  INTENTS,
  isSurfaceShape,
  isIntent,
  MACHINE_READABLE_BOUNDARY,
} from "./index.ts";

test("surface_shape is exactly the four canonical values (no drift)", () => {
  assert.deepEqual([...SURFACE_SHAPES], ["offered", "auction_like", "matching", "stand"]);
});

test("intent is exactly the three canonical values (no drift)", () => {
  assert.deepEqual([...INTENTS], ["wanted", "offered", "ask"]);
});

test("the guards accept canonical values and reject everything else", () => {
  for (const s of SURFACE_SHAPES) assert.ok(isSurfaceShape(s));
  for (const i of INTENTS) assert.ok(isIntent(i));

  // Strategy words and GPT's rejected extensions must NOT pass as public vocab.
  for (const bad of ["sale", "auction", "match", "collaborate", "hire", "sell", "bid", ""]) {
    assert.ok(!isSurfaceShape(bad), `surface_shape must reject "${bad}"`);
  }
  for (const bad of ["want", "offer", "asking", "sale", "", "WANTED"]) {
    assert.ok(!isIntent(bad), `intent must reject "${bad}"`);
  }
  for (const bad of [null, undefined, 1, {}, []]) {
    assert.ok(!isSurfaceShape(bad));
    assert.ok(!isIntent(bad));
  }
});

test("the machine-readable boundary is all-true and frozen (material, not judgment)", () => {
  assert.deepEqual(MACHINE_READABLE_BOUNDARY, {
    pxDoesNotSell: true,
    pxDoesNotSettle: true,
    pxDoesNotRecommend: true,
    ownerControlsAction: true,
  });
  assert.ok(Object.isFrozen(MACHINE_READABLE_BOUNDARY));
});
