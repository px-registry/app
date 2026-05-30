// Tests for the owner-memory validator. Run with `node --test`.
//
// Typed-or-rejected, owner-authored-or-rejected: the gate that keeps memory from
// becoming an arbitrary body and refuses AI-authored facts.

import { test } from "node:test";
import assert from "node:assert/strict";

import { validateNewMemory } from "./index.ts";

test("valid entries of each kind pass", () => {
  assert.ok(validateNewMemory({ kind: "saved_filter", provenance: "owner_written", value: { surfaceShape: "auction_like", intent: "wanted", query: "kyoto" } }).ok);
  assert.ok(validateNewMemory({ kind: "preference", provenance: "owner_written", value: { displayDensity: "compact" } }).ok);
  assert.ok(validateNewMemory({ kind: "interest", provenance: "owner_written", value: { label: "letterpress" } }).ok);
  assert.ok(validateNewMemory({ kind: "note", provenance: "owner_imported_confirmed", value: { text: "ask Hansei about platen press" } }).ok);
});

test("provenance is required and 'ai_generated' is refused (no AI-authored fact)", () => {
  assert.ok(!validateNewMemory({ kind: "interest", provenance: "ai_generated", value: { label: "x" } }).ok);
  assert.ok(!validateNewMemory({ kind: "interest", value: { label: "x" } }).ok); // missing
  assert.ok(!validateNewMemory({ kind: "interest", provenance: "", value: { label: "x" } }).ok);
});

test("unknown kinds and missing values are rejected", () => {
  assert.ok(!validateNewMemory({ kind: "behavior", provenance: "owner_written", value: {} }).ok);
  assert.ok(!validateNewMemory({ kind: "interest", provenance: "owner_written" }).ok);
  assert.ok(!validateNewMemory(null).ok);
});

test("saved_filter only accepts A1 canonical surfaceShape/intent", () => {
  assert.ok(!validateNewMemory({ kind: "saved_filter", provenance: "owner_written", value: { surfaceShape: "auction" } }).ok);
  assert.ok(!validateNewMemory({ kind: "saved_filter", provenance: "owner_written", value: { intent: "buy" } }).ok);
  assert.ok(validateNewMemory({ kind: "saved_filter", provenance: "owner_written", value: { surfaceShape: "stand" } }).ok);
});

test("typed values reject the wrong shape (no freeform body smuggling)", () => {
  assert.ok(!validateNewMemory({ kind: "note", provenance: "owner_written", value: { text: 42 } }).ok);
  assert.ok(!validateNewMemory({ kind: "interest", provenance: "owner_written", value: { label: "" } }).ok);
  assert.ok(!validateNewMemory({ kind: "preference", provenance: "owner_written", value: { displayDensity: "huge" } }).ok);
  assert.ok(!validateNewMemory({ kind: "saved_filter", provenance: "owner_written", value: { category: 5 } }).ok);
});
