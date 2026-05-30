// Tests for proposal generation. Run with `node --test`.
//
// Deterministic, grounded, no score. saved_filter sets ground in the filter;
// interest matches are plain substring; thin memory → thin proposals; every
// proposal carries a named memoryRef and the source params, and nothing else.

import { test } from "node:test";
import assert from "node:assert/strict";

import { composeProposals, listingMatchesInterest, type ResultSet } from "./index.ts";
import type { OwnerMemoryV1 } from "../owner-memory/index.ts";
import type { MatchableListing } from "./index.ts";

const mem = (over: Partial<OwnerMemoryV1> & Pick<OwnerMemoryV1, "kind" | "value">): OwnerMemoryV1 =>
  ({ memoryId: "m", createdAt: "t", updatedAt: "t", provenance: "owner_written", ...over } as OwnerMemoryV1);

const L = (recordId: string, title: string, extra: Partial<MatchableListing> = {}): MatchableListing => ({
  recordId,
  title,
  ...extra,
});

test("listingMatchesInterest is a case-insensitive substring over public text", () => {
  const l = L("r1", "Hand-bound NOTEBOOK", { summary: "linen", category: "auction" });
  assert.ok(listingMatchesInterest(l, "notebook"));
  assert.ok(listingMatchesInterest(l, "linen"));
  assert.ok(listingMatchesInterest(l, "auction"));
  assert.ok(!listingMatchesInterest(l, "radio"));
  assert.ok(!listingMatchesInterest(l, "   ")); // empty label never matches
});

test("a saved_filter result set grounds each listing in that filter", () => {
  const sets: ResultSet[] = [
    { savedFilterId: "sf1", params: { surface_shape: "stand" }, listings: [L("r1", "a"), L("r2", "b")] },
  ];
  const proposals = composeProposals([], sets);
  assert.equal(proposals.length, 2);
  assert.ok(proposals.every((p) => p.reason.kind === "matches_saved_filter" && p.reason.memoryRef === "sf1"));
  assert.deepEqual(proposals[0].sourceSearchParams, { surface_shape: "stand" });
});

test("an interest grounds matching listings; non-matches are not proposed", () => {
  const memory = [mem({ memoryId: "i1", kind: "interest", value: { label: "letterpress" } })];
  const sets: ResultSet[] = [
    { params: {}, listings: [L("r1", "Letterpress cards"), L("r2", "Stoneware mug")] },
  ];
  const proposals = composeProposals(memory, sets);
  assert.equal(proposals.length, 1);
  assert.equal(proposals[0].listingRecordId, "r1");
  assert.deepEqual(proposals[0].reason, { kind: "matches_saved_interest", memoryRef: "i1" });
});

test("cross-intent meeting works WITHOUT a matching surface (matching→working)", () => {
  // The owner seeks a "press operator" (wanted) and is interested in "letterpress".
  // A wanted row and an offered row, both on surviving surfaces (stand/offered),
  // both get grounded — the meeting working survives with zero matching surface.
  const memory = [mem({ memoryId: "i1", kind: "interest", value: { label: "letterpress" } })];
  const sets: ResultSet[] = [
    {
      params: {},
      listings: [
        L("seeker", "Looking for a letterpress operator", { region: "Kyoto" }), // a wanted-side listing
        L("provider", "Letterpress calling cards"), // an offered-side listing
      ],
    },
  ];
  const ids = composeProposals(memory, sets).map((p) => p.listingRecordId);
  assert.deepEqual(ids, ["seeker", "provider"]); // both surfaced, no matching surface anywhere
  assert.ok(!sets.some((s) => (s.params as { surface_shape?: string }).surface_shape === "matching"));
});

test("thin memory → thin proposals (no fabrication)", () => {
  assert.deepEqual(composeProposals([], [{ params: {}, listings: [L("r1", "x")] }]), []);
});

test("proposals dedupe by (listing, reason kind, memoryRef)", () => {
  const memory = [mem({ memoryId: "i1", kind: "interest", value: { label: "mug" } })];
  const sets: ResultSet[] = [
    { params: {}, listings: [L("r1", "Stoneware mug")] },
    { savedFilterId: "sf1", params: { category: "sale" }, listings: [L("r1", "Stoneware mug")] },
  ];
  const proposals = composeProposals(memory, sets);
  // r1 grounded once by interest, once by saved_filter — two distinct reasons.
  assert.equal(proposals.length, 2);
  const kinds = proposals.map((p) => p.reason.kind).sort();
  assert.deepEqual(kinds, ["matches_saved_filter", "matches_saved_interest"]);
});

test("proposal_order_preserves_neutral_board_order (no hidden ranking)", () => {
  // Neutral /search order is [r1, r2, r3]. r3 matches MORE interests than r2 — a
  // match-count / "better match" ranking would float r3 above r2. It must not.
  const memory = [
    mem({ memoryId: "alpha", kind: "interest", value: { label: "alpha" } }),
    mem({ memoryId: "beta", kind: "interest", value: { label: "beta" } }),
  ];
  const sets: ResultSet[] = [
    {
      params: {},
      listings: [L("r1", "nothing"), L("r2", "alpha only"), L("r3", "alpha and beta")],
    },
  ];
  const order = composeProposals(memory, sets).map((p) => p.listingRecordId);
  // r1 dropped (no match); r2 before r3 (neutral order), despite r3 matching more.
  assert.deepEqual(order, ["r2", "r3", "r3"]);
});

test("result-set order is preserved across sets (neutral order, not reordered)", () => {
  const memory = [mem({ memoryId: "i", kind: "interest", value: { label: "x" } })];
  const sets: ResultSet[] = [
    { params: {}, listings: [L("a", "x one")] },
    { savedFilterId: "sf", params: { category: "sale" }, listings: [L("b", "two"), L("c", "x three")] },
  ];
  // a (set 0, interest) → b (set 1, saved_filter) → c (set 1, saved_filter + interest).
  const order = composeProposals(memory, sets).map((p) => `${p.listingRecordId}:${p.reason.kind}`);
  assert.deepEqual(order, [
    "a:matches_saved_interest",
    "b:matches_saved_filter",
    "c:matches_saved_filter",
    "c:matches_saved_interest",
  ]);
});

test("a proposal carries ONLY listingRecordId, reason, sourceSearchParams (no score)", () => {
  const proposals = composeProposals([], [{ savedFilterId: "sf1", params: {}, listings: [L("r1", "x")] }]);
  assert.deepEqual(Object.keys(proposals[0]).sort(), ["listingRecordId", "reason", "sourceSearchParams"]);
  for (const banned of ["score", "rank", "priority", "confidence", "best", "weight"]) {
    assert.ok(!(banned in proposals[0]));
  }
});
