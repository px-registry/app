// Stage B+1 tweak (#4) — cross-intent candidates. Run with `node --test`.
//
// The meeting working the narrowed-out "matching" surface used to carry, rebuilt as
// a grounded, non-ranking, candidate-only proposal: the owner's saved position (a
// saved_filter intent) draws COMPLEMENTARY-intent listings as candidates. Asymmetric
// (C1 — `offered` draws only `wanted`, never `ask`), neutral order, no score.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { composeProposals, type ResultSet } from "./index.ts";
import { allProposalCopyStrings, PROPOSAL_REASON_LABELS } from "./index.ts";
import type { OwnerMemoryV1, SavedFilterValue } from "../owner-memory/index.ts";
import type { MatchableListing } from "./index.ts";

const here = (rel: string) => new URL(rel, import.meta.url);
const stripJs = (s: string) => s.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");

const savedFilter = (memoryId: string, value: SavedFilterValue): OwnerMemoryV1 =>
  ({ memoryId, kind: "saved_filter", provenance: "owner_written", createdAt: "t", updatedAt: "t", value } as OwnerMemoryV1);

const L = (recordId: string, intent: MatchableListing["intent"], extra: Partial<MatchableListing> = {}): MatchableListing => ({
  recordId,
  title: recordId,
  intent,
  ...extra,
});

const wholeBoard = (listings: MatchableListing[]): ResultSet => ({ params: {}, listings });

function crossIntentIds(memory: OwnerMemoryV1[], listings: MatchableListing[]): string[] {
  return composeProposals(memory, [wholeBoard(listings)])
    .filter((p) => p.reason.kind === "cross_intent_candidate")
    .map((p) => p.listingRecordId);
}

// ── Bplus1tweak-impl-1: cross-intent draws complementary listings ────────────────

test("Bplus1tweak-impl-1: a wanted position draws offered candidates; a same-intent listing is not a meeting", () => {
  const memory = [savedFilter("sf", { intent: "wanted" })];
  const listings = [
    L("offer", "offered", { surfaceShape: "offered" }),
    L("alsoWanted", "wanted", { surfaceShape: "stand" }), // same intent — not surfaced cross-intent
  ];
  assert.deepEqual(crossIntentIds(memory, listings), ["offer"]);
});

test("Bplus1tweak-impl-1: an offered position draws wanted candidates", () => {
  const memory = [savedFilter("sf", { intent: "offered" })];
  const listings = [L("seeker", "wanted", { surfaceShape: "stand" }), L("other", "offered", { surfaceShape: "offered" })];
  assert.deepEqual(crossIntentIds(memory, listings), ["seeker"]);
});

test("Bplus1tweak-impl-1: a wanted position draws a stand.ask open-call (gathering material)", () => {
  const memory = [savedFilter("sf", { intent: "wanted" })];
  const listings = [
    L("gathering", "ask", { surfaceShape: "stand" }), // stand.ask — open-call
    L("looseAsk", "ask", { surfaceShape: "offered" }), // ask but not on stand — NOT a wanted target
  ];
  assert.deepEqual(crossIntentIds(memory, listings), ["gathering"]);
});

// ── Bplus1tweak-impl-11: ask is asymmetric — never a fulfilled counterpart ───────

test("Bplus1tweak-impl-11: an offered position is NOT drawn to an `ask` (asymmetry, not a symmetric match)", () => {
  const memory = [savedFilter("sf", { intent: "offered" })];
  const listings = [L("inquiry", "ask", { surfaceShape: "stand" }), L("inquiry2", "ask", { surfaceShape: "offered" })];
  // offered → wanted ONLY. An inquiry is open-call material, not a fulfilled offer.
  assert.deepEqual(crossIntentIds(memory, listings), []);
});

// ── Bplus1tweak-impl-1: filter scope keeps candidates grounded ───────────────────

test("Bplus1tweak-impl-1: category/region scope the cross-intent candidates", () => {
  const memory = [savedFilter("sf", { intent: "wanted", category: "design", region: "Kyoto" })];
  const listings = [
    L("inScope", "offered", { surfaceShape: "offered", category: "design", region: "Kyoto" }),
    L("wrongCat", "offered", { surfaceShape: "offered", category: "bonsai", region: "Kyoto" }),
    L("wrongRegion", "offered", { surfaceShape: "offered", category: "design", region: "Osaka" }),
  ];
  assert.deepEqual(crossIntentIds(memory, listings), ["inScope"]);
});

// ── Bplus1tweak-impl-2: neutral order preserved (no ranking by the cross pass) ────

test("Bplus1tweak-impl-2: cross-intent does not reorder — neutral board order is kept", () => {
  const memory = [savedFilter("sf", { intent: "wanted" })];
  // Neutral order [a, b, c]; c is also interest-matched (more reasons) but must not float up.
  const listings = [
    L("a", "offered", { surfaceShape: "offered" }),
    L("b", "offered", { surfaceShape: "offered" }),
    L("c", "offered", { surfaceShape: "offered" }),
  ];
  const order = composeProposals(memory, [wholeBoard(listings)]).map((p) => p.listingRecordId);
  assert.deepEqual(order, ["a", "b", "c"]);
});

// ── Bplus1tweak-impl-5: grounded — named memoryRef + sourceSearchParams ───────────

test("Bplus1tweak-impl-5: a cross-intent proposal is grounded in the saved_filter (named memoryRef)", () => {
  const memory = [savedFilter("sf-pos", { intent: "wanted" })];
  const set: ResultSet = { params: { category: "x" }, listings: [L("offer", "offered", { surfaceShape: "offered" })] };
  const [p] = composeProposals(memory, [set]).filter((x) => x.reason.kind === "cross_intent_candidate");
  assert.equal(p.reason.memoryRef, "sf-pos");
  assert.deepEqual(p.sourceSearchParams, { category: "x" });
  // No score/rank fields snuck in.
  assert.deepEqual(Object.keys(p).sort(), ["listingRecordId", "reason", "sourceSearchParams"]);
});

// ── Bplus1tweak-impl-4: fail-closed on the LISTING side (no inference, no default) ─

test("Bplus1tweak-impl-4: a listing MISSING an intent or surface_shape is never a cross-intent candidate", () => {
  const memory = [savedFilter("sf", { intent: "wanted" })];
  const listings = [
    L("noIntent", undefined as never, { surfaceShape: "offered" }), // intent missing
    { recordId: "noSurface", title: "noSurface", intent: "offered" } as MatchableListing, // surfaceShape missing
    { recordId: "bare", title: "bare" } as MatchableListing, // both missing
    L("ok", "offered", { surfaceShape: "offered" }), // the only valid candidate
  ];
  assert.deepEqual(crossIntentIds(memory, listings), ["ok"]);
});

test("Bplus1tweak-impl-4: PX does not INFER intent from title/category/summary", () => {
  const memory = [savedFilter("sf", { intent: "wanted" })];
  // The title/summary/category scream "offered", but with no canonical intent field
  // the listing is NOT a candidate — PX reads the axis, it never guesses it.
  const listings = [
    { recordId: "looksOffered", title: "Offered: I am offering this", summary: "offered offered", category: "offered" } as MatchableListing,
  ];
  assert.deepEqual(crossIntentIds(memory, listings), []);
});

test("Bplus1tweak-impl-4: thin memory → no cross-intent candidates (no fabrication)", () => {
  // A saved_filter with NO intent declares no position — no cross-intent fires.
  const memory = [savedFilter("sf", { category: "design" })];
  assert.deepEqual(crossIntentIds(memory, [L("offer", "offered", { surfaceShape: "offered" })]), []);
});

// ── Bplus1tweak-impl-11: candidate-only wording — no match/成立/fit/settlement ────

test("Bplus1tweak-impl-11: the proposal lib + copy say `candidate`, never matched/成立/fit/settlement", () => {
  const surfaces = [
    stripJs(readFileSync(here("./propose.ts"), "utf8")),
    stripJs(readFileSync(here("./copy.ts"), "utf8")),
    stripJs(readFileSync(here("./types.ts"), "utf8")),
    allProposalCopyStrings().join("\n"),
  ].join("\n");
  for (const banned of ["matched", "成立", "settlement", "fulfilled offer", "success"]) {
    assert.ok(!surfaces.includes(banned), `cross-intent must not say "${banned}"`);
  }
  assert.ok(!/\bfit\b/i.test(surfaces), "cross-intent must not say a bare 'fit'");
  // The new reason exists and is candidate-worded.
  assert.ok(PROPOSAL_REASON_LABELS.cross_intent_candidate.en.toLowerCase().includes("candidate"));
});

// ── Bplus1tweak-impl-12: passive seam — no memory-selection hook / learning gate ──

test("Bplus1tweak-impl-12: no prediction-error / novelty / memory-selection API is introduced", () => {
  const src = ["propose.ts", "types.ts", "mapper.ts", "copy.ts", "boundary.ts"].map((f) => stripJs(readFileSync(here(`./${f}`), "utf8"))).join("\n").toLowerCase();
  for (const banned of [
    "predictionerror", "prediction_error", "surprise", "novelty", "learningscore", "learning_score",
    "memorygate", "selectmemoryforproposal", "consolidation",
  ]) {
    assert.ok(!src.includes(banned), `passive seam violated by "${banned}"`);
  }
  // The grounded seam is PRESERVED: every reason kind still carries a named memoryRef.
  const types = readFileSync(here("./types.ts"), "utf8");
  const reasonBlock = types.slice(types.indexOf("export type ProposalReason"), types.indexOf("export interface ProposalV1"));
  const kinds = reasonBlock.match(/kind: "([^"]+)"/g) ?? [];
  assert.equal(kinds.length, 3);
  for (const k of kinds) assert.ok(reasonBlock.includes("memoryRef"), `${k} must keep memoryRef`);
});

// ── Bplus1tweak-impl-13: owner approval is UI-only (no record / persistence) ──────

test("Bplus1tweak-impl-13: the proposal road creates no approval table / persistence / A2 event", () => {
  const proposeRoad = [
    ...["propose.ts", "types.ts", "mapper.ts", "copy.ts", "boundary.ts"].map((f) => stripJs(readFileSync(here(`./${f}`), "utf8"))),
    stripJs(readFileSync(here("../../app/proposals/Proposals.tsx"), "utf8")),
  ].join("\n").toLowerCase();
  for (const banned of [
    "approval", "writeback", "buildtransactionobject", "plandeclaration", "transaction_event",
    "insert into", "store.create", "store.put", ".put(", "owner_approval",
  ]) {
    assert.ok(!proposeRoad.includes(banned), `owner approval must stay UI-only — found "${banned}"`);
  }
});
