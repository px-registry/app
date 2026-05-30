// Tests for the memory→/search allowlist mapper. Run with `node --test`.
//
// Only saved_filter may become a neutral /search param; interest/note/preference
// never leave the device through this path. query crosses only on explicit apply.

import { test } from "node:test";
import assert from "node:assert/strict";

import { memoryToSearchParams, allowlistToQueryString } from "./index.ts";
import type { OwnerMemoryV1 } from "../owner-memory/index.ts";

const base = { memoryId: "m1", createdAt: "t", updatedAt: "t", provenance: "owner_written" } as const;

test("saved_filter maps to canonical params; query only with includeQuery", () => {
  const sf: OwnerMemoryV1 = { ...base, kind: "saved_filter", value: { surfaceShape: "auction_like", intent: "wanted", category: "matching", region: "Kyoto", query: "press" } };
  const noQ = memoryToSearchParams(sf, { includeQuery: false });
  assert.deepEqual(noQ, { surface_shape: "auction_like", intent: "wanted", category: "matching", region: "Kyoto" });
  assert.ok(!("query" in noQ!), "query must NOT be present on the proactive pass");

  const withQ = memoryToSearchParams(sf, { includeQuery: true });
  assert.equal(withQ!.query, "press");
});

test("interest / note / preference NEVER become server params (return null)", () => {
  const interest: OwnerMemoryV1 = { ...base, kind: "interest", value: { label: "bonsai" } };
  const note: OwnerMemoryV1 = { ...base, kind: "note", value: { text: "secret" } };
  const pref: OwnerMemoryV1 = { ...base, kind: "preference", value: { displayDensity: "compact" } };
  for (const e of [interest, note, pref]) {
    assert.equal(memoryToSearchParams(e, { includeQuery: true }), null);
  }
});

test("allowlistToQueryString uses the canonical /search param names", () => {
  const qs = allowlistToQueryString({ surface_shape: "stand", intent: "ask", query: "x" });
  const sp = new URLSearchParams(qs);
  assert.equal(sp.get("surface_shape"), "stand");
  assert.equal(sp.get("intent"), "ask");
  assert.equal(sp.get("q"), "x");
});
