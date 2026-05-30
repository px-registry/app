// Tests for the ownerPublicRef policy. Run with `node --test`.
//
// Enforced-by-test, not convention: emails, auth/credential handles, UUIDs, and
// private-id blobs are rejected so they can never reach a public record (§5.5/§7).

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  isPublicSafeOwnerRef,
  assertPublicSafeOwnerRef,
  SEED_BOARD_RECORDS,
} from "./index.ts";

test("human display labels are accepted", () => {
  for (const ok of [
    "Ito Atelier · ito-atelier.example",
    "Mariko Kiln · mariko.example",
    "Hansei Press",
    "Quiet Tapes · quiet-tapes.example",
  ]) {
    assert.ok(isPublicSafeOwnerRef(ok), `should accept "${ok}"`);
  }
});

test("auth-identity-shaped values are rejected (non-reversible to auth id)", () => {
  for (const bad of [
    "owner@example.com", // email
    "name.surname@mail.co.jp",
    "auth:ito-atelier-7f3a", // our private seed handle shape
    "handle:hansei-press",
    "session:abc123",
    "550e8400-e29b-41d4-a716-446655440000", // UUID
    "deadbeefdeadbeefdeadbeef0123", // hex blob
    "AbCdEf0123456789AbCdEf0123456789", // base64url blob, no spacing
    "",
    "   ",
    "x".repeat(200), // too long
  ]) {
    assert.ok(!isPublicSafeOwnerRef(bad), `should reject "${bad.slice(0, 24)}"`);
  }
  for (const bad of [null, undefined, 42, {}, []]) {
    assert.ok(!isPublicSafeOwnerRef(bad as unknown));
  }
});

test("assertPublicSafeOwnerRef throws on unsafe, returns trimmed on safe", () => {
  assert.throws(() => assertPublicSafeOwnerRef("auth:secret"));
  assert.throws(() => assertPublicSafeOwnerRef("a@b.com"));
  assert.equal(assertPublicSafeOwnerRef("  Hansei Press  "), "Hansei Press");
});

test("every A1 seed ownerPublicRef is public-safe; every private ownerHandle is NOT", () => {
  for (const row of SEED_BOARD_RECORDS) {
    assert.ok(
      isPublicSafeOwnerRef(row.ownerPublicRef),
      `seed ownerPublicRef not public-safe: ${row.ownerPublicRef}`,
    );
    // The private handle MUST fail the public test — proof the guard would catch
    // a leak if a handle were ever placed where a public ref belongs.
    assert.ok(
      !isPublicSafeOwnerRef(row.ownerHandle),
      `private ownerHandle wrongly passed: ${row.ownerHandle}`,
    );
  }
});
