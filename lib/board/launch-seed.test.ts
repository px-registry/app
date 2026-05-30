// Launch seed (#5) acceptance gates — explicit roll-up. Run with `node --test`.
//
// The 5 beta boards are a LAUNCH DEMO SEED (C1 = (b)): owner-owned-in-principle,
// `.example` + synthetic `auth:`, no fabricated activity. They demonstrate the
// existing stages by PASSING their own gates — minimum public criteria, Canonical
// 3×3, Contact-Kit-compatible contact, PublicBoardRow unreachable — with PX curating
// nothing (neutral order, no featured row).
//
//   LaunchSeed-impl-1   5 beta boards seeded (board-record system, not examples.json)
//   LaunchSeed-impl-2   ≥2 one-to-many (stand) boards + cross-intent fodder
//   LaunchSeed-impl-3   each board meets the minimum public criteria (title + row + contact)
//   LaunchSeed-impl-4   Canonical 3×3 only (no 'matching')
//   LaunchSeed-impl-5   contact action Contact-Kit-compatible (sanitized owner URL)
//   LaunchSeed-impl-6/12 PX curates nothing — neutral order, no featured/promoted field
//   LaunchSeed-impl-7   seed↔SQL no-drift for the new rows; examples.json untouched
//   LaunchSeed-impl-8   forbidden-copy scan (seed content, EN/JA)
//   LaunchSeed-impl-9   no fabricated activity (empty evidence/receipt; no sale/popularity copy)
//   LaunchSeed-impl-10  no "owner can edit" assertion in the seed copy (C2)
//   LaunchSeed-impl-11  contact public-safe (no phone/email/private; .example only)
//   LaunchSeed-impl-13  owner identity private (owner_public_ref only; no auth handle)

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { SEED_BOARD_RECORDS } from "./seed.ts";
import { toPublicRecord } from "./project.ts";
import { sanitizeExternalActionUrl } from "./url.ts";
import { SURFACE_SHAPES, INTENTS } from "./canonical.ts";

const here = (rel: string) => new URL(rel, import.meta.url);

/** The 5 launch-demo boards, by their public owner ref (the grouping key). */
const DEMO_OWNERS = [
  "Aoi Bonsai · aoi-bonsai.example",
  "Midori Design · midori-design.example",
  "Hina Fabrication · hina-fab.example",
  "Nagi Sound · nagi-sound.example",
  "Komorebi Kitchen · komorebi-kitchen.example",
];
const demo = SEED_BOARD_RECORDS.filter((r) => DEMO_OWNERS.includes(r.ownerPublicRef));
const boards = DEMO_OWNERS.map((o) => demo.filter((r) => r.ownerPublicRef === o));

// ── impl-1: 5 boards, board-record system ───────────────────────────────────────

test("LaunchSeed-impl-1: exactly 5 demo boards, each a group of ≥1 canonical row", () => {
  assert.equal(boards.filter((b) => b.length >= 1).length, 5);
  assert.equal(demo.length, 15);
});

// ── impl-2: ≥2 one-to-many (stand) + cross-intent fodder ─────────────────────────

test("LaunchSeed-impl-2: at least two one-to-many (stand) gatherings, across ≥2 owners", () => {
  const standOwners = new Set(demo.filter((r) => r.surfaceShape === "stand").map((r) => r.ownerPublicRef));
  const gatherings = demo.filter((r) => r.surfaceShape === "stand" && (r.intent === "wanted" || r.intent === "ask"));
  assert.ok(gatherings.length >= 2, "need ≥2 standing gatherings (1-to-many)");
  assert.ok(standOwners.size >= 2, "gatherings must span ≥2 owners");
});

test("LaunchSeed-impl-2: cross-intent is demonstrable — wanted AND offered both present", () => {
  assert.ok(demo.some((r) => r.intent === "wanted"), "need a wanted row");
  assert.ok(demo.some((r) => r.intent === "offered"), "need an offered row");
});

// ── impl-3: each board meets the minimum public criteria ─────────────────────────

test("LaunchSeed-impl-3: every board has a title, ≥1 row, and a contact action (structural)", () => {
  for (const b of boards) {
    assert.ok(b.length >= 1, "≥1 row"); // criterion: row
    for (const r of b) {
      assert.ok(r.title.trim().length > 0, `${r.recordId}: a title`); // criterion: title
      assert.ok(!!r.externalActionUrl, `${r.recordId}: a contact action`); // criterion: contact
    }
  }
});

// ── impl-4: Canonical 3×3 only ───────────────────────────────────────────────────

test("LaunchSeed-impl-4: every demo row is canonical (no 'matching')", () => {
  for (const r of demo) {
    assert.ok((SURFACE_SHAPES as readonly string[]).includes(r.surfaceShape), `${r.recordId}: surface`);
    assert.ok((INTENTS as readonly string[]).includes(r.intent), `${r.recordId}: intent`);
    assert.notEqual(r.surfaceShape as string, "matching");
  }
});

// ── impl-5 / impl-11: contact is Contact-Kit-compatible and public-safe ──────────

test("LaunchSeed-impl-5: every contact URL survives the A1 sanitizer (http/https owner link)", () => {
  for (const r of demo) {
    assert.equal(sanitizeExternalActionUrl(r.externalActionUrl), r.externalActionUrl, `${r.recordId}`);
  }
});

test("LaunchSeed-impl-11: contact is public-safe — no phone/email/private, .example placeholder only", () => {
  for (const r of demo) {
    const url = r.externalActionUrl!;
    assert.ok(/^https:\/\/[a-z0-9-]+\.example\//.test(url), `${r.recordId}: must be an .example placeholder`);
    for (const bad of ["tel:", "mailto:", "@", "wa.me", "line.me/ti", "t.me/"]) {
      assert.ok(!url.includes(bad), `${r.recordId}: forbidden contact form "${bad}"`);
    }
  }
});

// ── impl-9: no fabricated activity (C1) ──────────────────────────────────────────

test("LaunchSeed-impl-9: no fabricated activity — empty evidence/receipt, no sale/popularity copy", () => {
  for (const r of demo) {
    assert.deepEqual(r.evidenceRefs, [], `${r.recordId}: no fabricated evidence`);
    assert.deepEqual(r.receiptRefs, [], `${r.recordId}: no fabricated receipt`);
  }
  const copy = demo.flatMap((r) => [r.title, r.summary ?? ""]).join("\n").toLowerCase();
  for (const banned of ["成立", "完売", "受賞", "sold out", "sold", "売れました", "完了", "実績多数", "多数の取引"]) {
    assert.ok(!copy.includes(banned), `fabricated-activity copy: "${banned}"`);
  }
});

// ── impl-8 / impl-12: forbidden-copy + neutral order (PX curates nothing) ─────────

test("LaunchSeed-impl-8: seed content has no PX-curator / ranking wording (EN/JA)", () => {
  const copy = demo.flatMap((r) => [r.ownerPublicRef, r.title, r.summary ?? ""]).join("\n").toLowerCase();
  for (const banned of [
    "おすすめ", "最適", "人気", "スコア", "マッチング", "注目", "選ばれた", "pxが選んだ",
    "featured", "recommended", "best ", "popular", "top pick",
  ]) {
    assert.ok(!copy.includes(banned), `forbidden seed copy: "${banned}"`);
  }
});

test("LaunchSeed-impl-6/12: neutral order — no featured/promoted field or curation marker in seed/SQL", () => {
  // Records carry no ranking field.
  for (const r of demo) {
    for (const k of ["featured", "promoted", "rank", "score", "pinned", "highlight"]) {
      assert.ok(!(k in (r as unknown as Record<string, unknown>)), `record must not carry ${k}`);
    }
  }
  // Strip comments first — the prose explains the boundary ("no row is featured"),
  // which is the opposite of curating; only the data/code must be clean.
  const stripJs = (s: string) => s.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
  const stripSql = (s: string) => s.replace(/--.*$/gm, "");
  const sources = [stripJs(readFileSync(here("./seed.ts"), "utf8")), stripSql(readFileSync(here("../../migrations/0002_seed_board.sql"), "utf8"))]
    .join("\n")
    .toLowerCase();
  for (const banned of ["featured", "promoted", "pinned", "highlighted", "px-selected", "注目", "おすすめ"]) {
    assert.ok(!sources.includes(banned), `seed source must not curate via "${banned}"`);
  }
});

// ── impl-7: no-drift + examples.json untouched + PublicBoardRow unreachable ───────

test("LaunchSeed-impl-7: every demo recordId is present in the seed migration (no drift)", () => {
  const sql = readFileSync(here("../../migrations/0002_seed_board.sql"), "utf8");
  for (const r of demo) assert.ok(sql.includes(`'${r.recordId}'`), `seed SQL missing ${r.recordId}`);
});

test("LaunchSeed-impl-7: examples.json is untouched — it carries none of the demo boards", () => {
  const examples = readFileSync(here("../../data/examples.json"), "utf8");
  for (const owner of DEMO_OWNERS) assert.ok(!examples.includes(owner.split(" · ")[1]), `examples.json must not carry ${owner}`);
  for (const r of demo) assert.ok(!examples.includes(r.recordId), `examples.json must not carry ${r.recordId}`);
});

// ── impl-13: owner identity is private (only owner_public_ref is exposed) ─────────

test("LaunchSeed-impl-13: the public projection of a demo board never exposes the auth handle", () => {
  const blob = JSON.stringify(demo.map(toPublicRecord));
  assert.ok(!blob.includes("auth:"), "no private auth handle value");
  assert.ok(!blob.includes("ownerHandle"), "no private handle key");
  // The public ref IS present (that is the only owner identity served).
  for (const owner of DEMO_OWNERS) assert.ok(blob.includes(owner), `${owner} public ref should be served`);
});

// ── impl-10: no over-claim of owner editability (C2) ─────────────────────────────

test("LaunchSeed-impl-10: the seed copy does not assert 'owner can edit' (no owner-write endpoint yet)", () => {
  const copy = (readFileSync(here("./seed.ts"), "utf8") + demo.map((r) => `${r.title}\n${r.summary}`).join("\n")).toLowerCase();
  for (const banned of ["owner can edit", "あなたが編集できます", "編集できます", "編集可能", "you can edit this board"]) {
    assert.ok(!copy.includes(banned), `must not over-claim editability: "${banned}"`);
  }
});
