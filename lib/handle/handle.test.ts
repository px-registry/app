// Unit tests for handle validation. Run with: npm test (node --test).

import { test } from "node:test";
import assert from "node:assert/strict";

import { validateHandle } from "./validate.ts";
import { RESERVED_HANDLES, HANDLE_MAX } from "./constants.ts";

test("accepts a simple lowercase handle", () => {
  const r = validateHandle("mariko");
  assert.equal(r.valid, true);
  assert.equal(r.valid && r.handle, "mariko");
});

test("accepts digits and internal hyphens", () => {
  assert.equal(validateHandle("ito-atelier").valid, true);
  assert.equal(validateHandle("studio-7").valid, true);
  assert.equal(validateHandle("a1b").valid, true);
});

test("trims surrounding whitespace and returns the trimmed handle", () => {
  const r = validateHandle("  mariko  ");
  assert.equal(r.valid, true);
  assert.equal(r.valid && r.handle, "mariko");
});

test("rejects too-short and too-long handles", () => {
  assert.deepEqual(validateHandle("ab"), { valid: false, reason: "invalid" });
  assert.deepEqual(validateHandle("a".repeat(HANDLE_MAX + 1)), {
    valid: false,
    reason: "invalid",
  });
});

test("rejects uppercase, spaces, and illegal characters", () => {
  assert.equal(validateHandle("Mariko").valid, false);
  assert.equal(validateHandle("with space").valid, false);
  assert.equal(validateHandle("under_score").valid, false);
  assert.equal(validateHandle("dot.dot").valid, false);
});

test("rejects leading/trailing/consecutive hyphens", () => {
  assert.equal(validateHandle("-lead").valid, false);
  assert.equal(validateHandle("trail-").valid, false);
  assert.equal(validateHandle("a--b").valid, false);
});

test("rejects non-string input", () => {
  assert.deepEqual(validateHandle(undefined), { valid: false, reason: "invalid" });
  assert.deepEqual(validateHandle(123), { valid: false, reason: "invalid" });
});

test("flags reserved names with reason 'reserved'", () => {
  assert.deepEqual(validateHandle("admin"), { valid: false, reason: "reserved" });
  assert.deepEqual(validateHandle("app"), { valid: false, reason: "reserved" });
  assert.deepEqual(validateHandle("api"), { valid: false, reason: "reserved" });
});

test("every reserved handle is itself rejected as reserved", () => {
  for (const h of RESERVED_HANDLES) {
    // Some reserved words are shorter than HANDLE_MIN (e.g. "ns", "px"); those
    // fail the length check first. The contract we assert is simply: never valid.
    assert.equal(validateHandle(h).valid, false, `reserved handle leaked: ${h}`);
  }
});
