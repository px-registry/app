// Stage A1 acceptance gates — explicit roll-up. Run with `node --test`.
//
// The 11 Phase-9A gates + 3 Attested-Board gates, each asserted by number. Some
// are proven in the focused suites (noted inline); this file is the single place
// you can read down the list and see every gate has a test.
//
//   9A-1  /search route exists ............. functions/api/search.test.ts
//   9A-2  GET /search returns D1 rows ....... functions/api/search.test.ts
//   9A-3  auction_like row appears .......... here
//   9A-4  matching ABSENT + 9A-4b cross-intent meeting .. here
//   9A-5  offered/stand row appears ......... here
//   9A-6  wanted row appears ................ here
//   9A-7  all rows route to detail/surface .. here
//   9A-8  no private fields leak ............ project.test.ts (+ here)
//   9A-9  no PX-as-seller/auctioneer wording. here
//   9A-10 no hidden ranking/paid boost ...... query.test.ts
//   9A-11 e2e cross-surface search green .... here
//   9A-12 every row has all-true boundary ... project.test.ts (+ here)
//   9A-13 surface_shape/intent canonical-only (CHECK + types) ... here
//   9A-14 no pack_id on board rows .......... project.test.ts (+ here)

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  parseSearchParams,
  filterBoard,
  toPublicRecord,
  boardDetailPath,
  allBoardLabelStrings,
  SURFACE_SHAPES,
  INTENTS,
  SEED_BOARD_RECORDS,
} from "./index.ts";

function search(query: string) {
  return filterBoard(SEED_BOARD_RECORDS, parseSearchParams(new URLSearchParams(query)));
}
const readMigration = (name: string) =>
  readFileSync(new URL(`../../migrations/${name}`, import.meta.url), "utf8");
const readSource = (rel: string) =>
  readFileSync(new URL(rel, import.meta.url), "utf8");

// ── presence gates (9A-3 .. 9A-6) ──────────────────────────────────────────────

test("9A-3: an auction_like row appears in /search", () => {
  assert.ok(search("surface_shape=auction_like").length > 0);
});

test("9A-4: the matching surface_shape is ABSENT from the API, rows, seed, and copy", () => {
  // Narrowed out. No row carries it; no filter returns it; no label names it.
  assert.equal(search("surface_shape=matching").length, 0);
  assert.ok(!SEED_BOARD_RECORDS.some((r) => (r.surfaceShape as string) === "matching"));
  assert.ok(!SEED_BOARD_RECORDS.some((r) => r.category === "matching"));
  assert.ok(!allBoardLabelStrings().some((l) => l.toLowerCase().includes("matching")));
  assert.ok(!allBoardLabelStrings().some((l) => l.includes("マッチング")));
});

test("9A-4b: cross-intent meeting survives without a matching surface", () => {
  // The "working" matching used to hold now lives on the intent axis: wanted rows
  // and offered/ask rows coexist across offered/auction_like/stand, so the owner's
  // AI can pair them (B+1) without any matching surface_shape.
  const wanted = search("intent=wanted");
  const offered = search("intent=offered");
  const ask = search("intent=ask");
  assert.ok(wanted.length > 0 && offered.length > 0 && ask.length > 0);
  // The wanted row(s) sit on a surviving surface, ready to meet offered/ask.
  assert.ok(wanted.every((r) => (SURFACE_SHAPES as readonly string[]).includes(r.surfaceShape)));
});

test("9A-5: offered and stand rows appear in /search", () => {
  assert.ok(search("surface_shape=offered").length > 0);
  assert.ok(search("surface_shape=stand").length > 0);
});

test("9A-6: a wanted-intent row appears in /search", () => {
  assert.ok(search("intent=wanted").length > 0);
});

// ── routing (9A-7) ──────────────────────────────────────────────────────────────

test("9A-7: every row routes to a public detail surface", () => {
  for (const rec of SEED_BOARD_RECORDS.map(toPublicRecord)) {
    const href = boardDetailPath(rec);
    assert.match(href, /^\/board\/\?id=/);
    // The id round-trips out of the path and selects exactly that record.
    const id = new URLSearchParams(href.split("?")[1]).get("id");
    assert.equal(id, rec.recordId);
    assert.equal(search(`recordId=${encodeURIComponent(rec.recordId)}`).length, 1);
  }
});

// ── no-leak, boundary, no-pack_id (9A-8 / 9A-12 / 9A-14, summarized) ────────────

test("9A-8/12/14: public rows hide owner_handle, stamp boundary, carry no pack_id", () => {
  const blob = JSON.stringify(SEED_BOARD_RECORDS.map(toPublicRecord));
  assert.ok(!blob.includes("auth:")); // 9A-8: no private handle value
  assert.ok(!blob.includes("ownerHandle")); // 9A-8: no private key
  assert.ok(!blob.includes("pack_id") && !blob.includes("packId")); // 9A-14
  for (const rec of SEED_BOARD_RECORDS.map(toPublicRecord)) {
    assert.equal(rec.machineReadableBoundary.pxDoesNotSell, true); // 9A-12
    assert.equal(rec.machineReadableBoundary.pxDoesNotSettle, true);
    assert.equal(rec.machineReadableBoundary.pxDoesNotRecommend, true);
    assert.equal(rec.machineReadableBoundary.ownerControlsAction, true);
  }
});

// ── privacy enforced at the query layer (hard-req §2) ───────────────────────────

test("§2: the /search query SELECTs explicit public columns — never owner_handle", () => {
  const src = readSource("../../functions/_board.ts");
  // No blanket SELECT * query (match an actual statement, not the prose comment).
  assert.ok(!/SELECT\s+\*\s+FROM/i.test(src), "must not SELECT * FROM");
  // The private column is never named in the fetched column list.
  const cols = src.match(/const PUBLIC_COLUMNS\s*=\s*([\s\S]*?);/);
  assert.ok(cols, "PUBLIC_COLUMNS list must exist");
  assert.ok(!cols![1].includes("owner_handle"), "owner_handle must not be selected");
  // No internal-id columns leak into the fetched set either.
  for (const banned of ["credential_id", "owner_id", "local_id", "recovery_code"]) {
    assert.ok(!cols![1].includes(banned), `must not select ${banned}`);
  }
});

// ── external action URL sanitized (hard-req §4) ─────────────────────────────────

test("§4: an unsafe externalActionUrl never survives projection", () => {
  for (const bad of ["javascript:alert(1)", "data:text/html,x", "file:///x", "blob:https://x/y"]) {
    const rec = toPublicRecord({ ...SEED_BOARD_RECORDS[0], externalActionUrl: bad });
    assert.ok(!("externalActionUrl" in rec), `unsafe url survived: ${bad}`);
  }
  // The seed's own https links (every seed row has one) survive unchanged.
  const withUrl = SEED_BOARD_RECORDS.find((r) => r.externalActionUrl);
  assert.ok(withUrl, "expected a seed row with an action URL");
  assert.equal(toPublicRecord(withUrl!).externalActionUrl, withUrl!.externalActionUrl);
});

// ── no bare "auction" in the new board public surface (hard-req §7 / N1) ────────

test("§7: no seed record carries a bare-\"auction\" category (new public surface)", () => {
  for (const r of SEED_BOARD_RECORDS) {
    assert.notEqual(r.category, "auction", `${r.recordId} carries bare auction category`);
    assert.notEqual(r.category, "オークション");
  }
});

// ── wording (9A-9) + N1 ─────────────────────────────────────────────────────────

test("9A-9/N1: no PX-as-seller/auctioneer wording; auction shown as auction-like", () => {
  // The public surface = projected records + the board's own labels.
  const surface = (
    JSON.stringify(SEED_BOARD_RECORDS.map(toPublicRecord)) +
    "\n" +
    allBoardLabelStrings().join("\n")
  ).toLowerCase();

  // PX never casts itself as the transacting party (9A-9).
  for (const banned of [
    "px sells",
    "px is selling",
    "sold by px",
    "px auction",
    "pxオークション",
    "px が販売",
    "escrow",
    "px settles",
    "px holds your",
  ]) {
    assert.ok(!surface.includes(banned), `banned wording present: "${banned}"`);
  }

  // N1: the label for auction_like is "auction-like"/「入札型」 — never bare
  // "auction"/「オークション」 in the board's own public copy.
  const labels = allBoardLabelStrings();
  assert.ok(labels.includes("Auction-like"));
  assert.ok(labels.includes("入札型"));
  assert.ok(!labels.includes("Auction"));
  assert.ok(!labels.some((l) => l.includes("オークション")));
});

// ── cross-surface e2e (9A-11) ───────────────────────────────────────────────────

test("9A-11: cross-surface search is green (all three shapes, filter→project→route)", () => {
  // Browser e2e is out of node:test scope; this exercises the full chain —
  // parse → filter → project → route — across every surface_shape in one pass.
  const all = search("").map(toPublicRecord);
  const shapesSeen = new Set(all.map((r) => r.surfaceShape));
  for (const shape of SURFACE_SHAPES) {
    assert.ok(shapesSeen.has(shape), `surface ${shape} missing from full search`);
  }
  // Every projected row is routable and round-trips to a single record.
  for (const rec of all) {
    const id = new URLSearchParams(boardDetailPath(rec).split("?")[1]).get("id");
    assert.equal(search(`recordId=${encodeURIComponent(id ?? "")}`).length, 1);
  }
  // Intents are covered too (independent axis).
  const intentsSeen = new Set(all.map((r) => r.intent));
  for (const intent of INTENTS) assert.ok(intentsSeen.has(intent));
});

// ── canonical enforced at the DB layer (9A-13) ──────────────────────────────────

test("9A-13: the NARROWED canonical (3 shapes) is enforced at the DB layer", () => {
  // The effective CHECK is the narrowing migration's — surface_shape ∈ 3 values,
  // matching removed. (0001's 4-value CHECK is historical, superseded by 0005.)
  const narrow = readMigration("0005_narrow_surface_shape.sql");
  assert.match(
    narrow,
    /CHECK\s*\(\s*surface_shape\s+IN\s*\(\s*'offered',\s*'auction_like',\s*'stand'\s*\)\s*\)/,
  );
  assert.match(
    narrow,
    /CHECK\s*\(\s*intent\s+IN\s*\(\s*'wanted',\s*'offered',\s*'ask'\s*\)\s*\)/,
  );
  // The narrowed CHECK must NOT list matching (or any other kind).
  const checkClause = narrow.match(/surface_shape\s+IN\s*\(([^)]*)\)/)![1];
  for (const banned of ["matching", "sale", "auction'", "match'", "collaborate", "bid"]) {
    assert.ok(!checkClause.includes(banned), `narrowed CHECK must not list ${banned}`);
  }
  // The rebuild copies columns explicitly (no SELECT *) and never resurrects
  // pack_id. Strip `--` comments first (the migration documents "NO SELECT *").
  const narrowNoComments = narrow.replace(/--.*$/gm, "");
  assert.ok(!/SELECT\s+\*/i.test(narrowNoComments), "rebuild must use explicit column copy");
  assert.ok(!/\bpack_id\b/.test(narrowNoComments));
});

// ── seed ↔ migration sync (no drift) ────────────────────────────────────────────

test("seed.ts and the seed migration cannot drift", () => {
  const sql = readMigration("0002_seed_board.sql");
  for (const row of SEED_BOARD_RECORDS) {
    assert.ok(sql.includes(`'${row.recordId}'`), `seed SQL missing ${row.recordId}`);
  }
  // Same row count on both sides.
  const inserted = (sql.match(/'rec-[a-z0-9-]+'/g) ?? []).filter(
    (m, i, a) => a.indexOf(m) === i,
  );
  assert.equal(inserted.length, SEED_BOARD_RECORDS.length);
});

test("seed covers every surface_shape and every intent (gates have rows to find)", () => {
  const shapes = new Set(SEED_BOARD_RECORDS.map((r) => r.surfaceShape));
  const intents = new Set(SEED_BOARD_RECORDS.map((r) => r.intent));
  for (const s of SURFACE_SHAPES) assert.ok(shapes.has(s), `seed missing shape ${s}`);
  for (const i of INTENTS) assert.ok(intents.has(i), `seed missing intent ${i}`);
});

test("seed gate: meeting persists with ZERO matching surface (1-to-1 AND 1-to-many)", () => {
  // The removed matching surface must not leave "meeting" degraded into a pile of
  // listings. The intent axis carries it, with no matching surface_shape:
  assert.ok(!SEED_BOARD_RECORDS.some((r) => (r.surfaceShape as string) === "matching"));

  // 1-to-1: a seeker and a provider exist that an owner-side proposal can pair —
  // a `wanted` row and an `offered` row, on surviving surfaces.
  const wanted = SEED_BOARD_RECORDS.filter((r) => r.intent === "wanted");
  const offered = SEED_BOARD_RECORDS.filter((r) => r.intent === "offered");
  assert.ok(wanted.length > 0 && offered.length > 0, "need a seeker + a provider to pair");

  // 1-to-many: a standing, open gathering point — a `stand` row inviting many
  // responses (an `ask`), so a group can form around it.
  const gathering = SEED_BOARD_RECORDS.filter((r) => r.surfaceShape === "stand" && r.intent === "ask");
  assert.ok(gathering.length > 0, "need a standing open call (1-to-many gathering)");
});
