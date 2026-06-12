// Board Templates v1 acceptance gates — explicit roll-up. Run with `node --test`.
//
//   BoardTemplate-impl-1   BoardTemplateV1 canonical-compliant scaffold ... catalog + here
//   BoardTemplate-impl-2   template optional (blank board stands) ......... draft-store.test.ts
//   BoardTemplate-impl-3   min criteria = title + ≥1 row + contact (struct) criteria.test.ts + here
//   BoardTemplate-impl-4   0-row board cannot be public (empty-board prev) . criteria.test.ts
//   BoardTemplate-impl-5   draft→public owner action; public→draft too .... draft-store.test.ts
//   BoardTemplate-impl-6   no rank/score/featured/recommended field ........ here (grep)
//   BoardTemplate-impl-7   UI copy forbidden-phrase scan green (EN/JA) ..... here
//   BoardTemplate-impl-8   TEMPLATE_BOUNDARY; all other boundaries untouched here
//   BoardTemplate-impl-9   Canonical 3-shape intact; no migration added .... here
//   BoardTemplate-impl-10  UI grouping / owner-local — no new D1 board table here (grep)
//   BoardTemplate-impl-11  contact = ContactKit-compatible readiness only .. here (no body/handle/inbox/relay/queue)
//   BoardTemplate-impl-12  criteria-pass ≠ auto-publish (owner explicit) ... draft-store.test.ts + here
//   BoardTemplate-impl-13  draft/private never sent to server (no network) . here
//   BoardTemplate-impl-14  template order neutral (no usage/popular/persnl) . here (grep)
//   BoardTemplate-impl-15  titleHint placeholder only, never auto-filled .... instantiate.test.ts + here

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

import {
  BOARD_TEMPLATES,
  TEMPLATE_BOUNDARY,
  allBoardTemplateCopyStrings,
  projectForPublish,
  type DraftBoardV1,
} from "./index.ts";
import {
  MACHINE_READABLE_BOUNDARY,
  TRANSACTION_BOUNDARY,
  SURFACE_SHAPES,
  INTENTS,
  isSurfaceShape,
  isIntent,
} from "../board/index.ts";
import { OWNER_MEMORY_BOUNDARY, MEMORY_KINDS } from "../owner-memory/index.ts";
import { PROPOSAL_BOUNDARY } from "../owner-agent/index.ts";
import { CONTACT_BOUNDARY } from "../contact/index.ts";

const here = (rel: string) => new URL(rel, import.meta.url);
const stripJs = (s: string) => s.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");

/** All non-test Board Templates lib sources, comment-stripped. */
function libSources(): string[] {
  const out: string[] = [];
  for (const ent of readdirSync(here("."), { withFileTypes: true })) {
    if (ent.name.endsWith(".ts") && !ent.name.endsWith(".test.ts")) {
      out.push(stripJs(readFileSync(here(`./${ent.name}`), "utf8")));
    }
  }
  return out;
}
function allFunctionSources(): string[] {
  const out: string[] = [];
  const walk = (rel: string) => {
    for (const ent of readdirSync(here(rel), { withFileTypes: true })) {
      const p = `${rel}/${ent.name}`;
      if (ent.isDirectory()) walk(p);
      else if (ent.name.endsWith(".ts") && !ent.name.endsWith(".test.ts")) out.push(readFileSync(here(p), "utf8"));
    }
  };
  walk("../../functions");
  return out;
}

// ── impl-1: the catalog is a canonical-compliant scaffold ────────────────────────

test("BoardTemplate-impl-1: every template row uses only the canonical 3×3 axes", () => {
  assert.ok(BOARD_TEMPLATES.length >= 1);
  for (const t of BOARD_TEMPLATES) {
    assert.equal(typeof t.templateId, "string");
    assert.ok(t.suggestedRows.length >= 1, `${t.templateId} must suggest at least one row`);
    for (const r of t.suggestedRows) {
      assert.ok(isSurfaceShape(r.surfaceShape), `${t.templateId}: non-canonical surface_shape`);
      assert.ok(isIntent(r.intent), `${t.templateId}: non-canonical intent`);
      assert.equal(typeof r.titleHint, "string");
    }
  }
});

// ── impl-6 / impl-14: no ranking field; order is neutral (fixed registration) ────

test("BoardTemplate-impl-6: no rank/score/featured/recommended/priority field anywhere in the lib", () => {
  const src = libSources().join("\n").toLowerCase();
  for (const banned of ["featured", "promoted", "recommended", "popular", "priority", "score", "ranking", "rank(", "boost"]) {
    assert.ok(!src.includes(banned), `Board Templates lib must not contain "${banned}" (comment-stripped)`);
  }
});

test("BoardTemplate-impl-14: template order is fixed registration order — no usage/popular/personalized sort", () => {
  const catalog = stripJs(readFileSync(here("./catalog.ts"), "utf8")).toLowerCase();
  for (const banned of [".sort(", "usage", "popular", "personaliz", "trending", "most used", "success"]) {
    assert.ok(!catalog.includes(banned), `catalog must not sort/rank by "${banned}"`);
  }
  // The catalog is frozen so its order cannot be mutated into a ranking at runtime.
  assert.ok(Object.isFrozen(BOARD_TEMPLATES));
});

// ── impl-7: UI copy forbidden-phrase scan (phrase-based, EN/JA) ───────────────────

test("BoardTemplate-impl-7: no PX-as-curator / ranking / 'good board' wording in any surface copy", () => {
  const catalogStrings = BOARD_TEMPLATES.flatMap((t) => [t.useCaseLabel, ...t.suggestedRows.map((r) => r.titleHint)]);
  const surface = [...allBoardTemplateCopyStrings(), ...catalogStrings].join("\n").toLowerCase();
  for (const banned of [
    // EN phrases (C7 — phrase-based, not a bare "good"/"best" grep)
    "good board", "better board", "best board", "recommended", "featured", "promoted",
    "popular", "top board", "px picks", "px recommends",
    // JA phrases
    "おすすめ", "最適", "人気", "良い板", "良いテンプレート", "あなたに合う", "よく使われ",
    "pxが選んだ", "pxのおすすめ", "上位", "ランキング", "スコア",
  ]) {
    assert.ok(!surface.includes(banned), `forbidden board-template copy: "${banned}"`);
  }
});

// ── impl-8: boundary stamp + isolation ───────────────────────────────────────────

test("BoardTemplate-impl-8: TEMPLATE_BOUNDARY is its own frozen, all-true constant", () => {
  assert.deepEqual(TEMPLATE_BOUNDARY, {
    pxDoesNotRankBoards: true,
    pxDoesNotJudgeContent: true,
    templateIsScaffold: true,
    minCriteriaIsStructural: true,
  });
  assert.ok(Object.isFrozen(TEMPLATE_BOUNDARY));
});

test("BoardTemplate-impl-8: no Board Templates key leaks into A1/A2/B/B+1/Contact boundaries", () => {
  for (const k of Object.keys(TEMPLATE_BOUNDARY)) {
    assert.ok(!(k in MACHINE_READABLE_BOUNDARY), `A1 boundary must not gain ${k}`);
    assert.ok(!(k in TRANSACTION_BOUNDARY), `A2 boundary must not gain ${k}`);
    assert.ok(!(k in OWNER_MEMORY_BOUNDARY), `B boundary must not gain ${k}`);
    assert.ok(!(k in PROPOSAL_BOUNDARY), `B+1 boundary must not gain ${k}`);
    assert.ok(!(k in CONTACT_BOUNDARY), `Contact boundary must not gain ${k}`);
  }
  // The A1 boundary keeps exactly its four keys (regression).
  assert.deepEqual(Object.keys(MACHINE_READABLE_BOUNDARY).sort(), [
    "ownerControlsAction", "pxDoesNotRecommend", "pxDoesNotSell", "pxDoesNotSettle",
  ]);
});

// ── impl-9: canonical intact; the publish projection reuses the A1 boundary ──────

test("BoardTemplate-impl-9: Canonical 3-shape / 3-intent are intact (not extended)", () => {
  assert.deepEqual([...SURFACE_SHAPES], ["offered", "auction_like", "stand"]);
  assert.deepEqual([...INTENTS], ["wanted", "offered", "ask"]);
});

test("BoardTemplate-impl-9: the publish projection REUSES the A1 machineReadableBoundary (no new boundary minted)", () => {
  const draft: DraftBoardV1 = {
    draftId: "d", boardTitle: "B",
    rows: [{ rowId: "r", surfaceShape: "offered", intent: "offered", title: "x" }],
    contact: { kind: "public_external_link", externalActionUrl: "https://x.test/a" },
    publicationState: "draft", createdAt: "t", updatedAt: "t",
  };
  const projected = projectForPublish(draft);
  assert.equal(projected.machineReadableBoundary, MACHINE_READABLE_BOUNDARY); // same reference
  assert.equal(projected.rows[0].externalActionUrl, "https://x.test/a"); // sanitized via A1 policy
});

test("BoardTemplate-impl-9: Board Templates added no migration; no board-template / draft table exists", () => {
  // Board Templates introduced NO migration of its own (owner-local scaffold). The
  // migrations added after Canonical are 0006 — a LATER, separately sanctioned
  // stage (Owner Board Publish v0) that adds a publication_state COLUMN to the
  // existing board_records (the A1 public table), not a board_template / draft /
  // board-state table — and 0007, the R1.5 meet stage (STOP #1/#2 sanctioned:
  // public projection / signal / mutual contact note / facilitator log; still
  // no board-template, draft, or owner-memory table) — and 0008, the R1.5
  // 第7便 ひとこと紹介 column on r15_pool_item (owner-published projection,
  // same standing as display_name) — and 0010, the R2 edge stage (STOP②
  // gate-passed: docs/r2/0010-edge-and-item-ref.md; item_ref alias column +
  // r15_edge metadata — still no board-template, draft, or owner-memory
  // table). The set stays locked so any surprise migration still trips.
  const files = readdirSync(here("../../migrations")).filter((f) => f.endsWith(".sql")).sort();
  assert.deepEqual(files, [
    "0001_board_records.sql",
    "0002_seed_board.sql",
    "0003_transaction_events.sql",
    "0004_declarations.sql",
    "0005_narrow_surface_shape.sql",
    "0006_publication_state.sql",
    "0007_r15_meet.sql",
    "0008_r15_intro.sql",
    "0009_r15_question_serve.sql",
    "0010_r15_edge.sql",
    "0011_r15_edge_close_facts.sql",
    "0012_business_flag.sql",
    "0014_e2ee_envelope.sql",
  ]);
});

// ── impl-10: owner-local — no server table/route/state for drafts or templates ───

test("BoardTemplate-impl-10: no migration defines a board-template / draft / board-state table", () => {
  // The real invariant: drafts/templates never get a server table — owner-local
  // state never lands in D1. `publication_state` is NOT banned here: it is the
  // Owner Board Publish public-row lifecycle (public/retired) on board_records, the
  // already-public A1 table — a row only gets it AFTER the owner publishes it, so
  // owner-local DRAFT state still never reaches the server.
  for (const ent of readdirSync(here("../../migrations"))) {
    const sql = stripJs(readFileSync(here(`../../migrations/${ent}`), "utf8")).toLowerCase();
    for (const banned of ["board_template", "board_draft", "draft_board", "create table draft", "create table template"]) {
      assert.ok(!sql.includes(banned), `${ent} must not define ${banned}`);
    }
  }
});

test("BoardTemplate-impl-10/13: no Function imports board-template or receives a draft", () => {
  for (const src of allFunctionSources()) {
    assert.ok(!/board-template/.test(src), "a Function imports board-template");
    assert.ok(!/DraftBoardV1|BoardTemplateV1/.test(src), "a Function references a draft/template type");
  }
  // No functions/api/board-template (or .../board/template) route exists on disk.
  let hasRoute = true;
  try {
    readdirSync(here("../../functions/api/board-template"));
  } catch {
    hasRoute = false;
  }
  assert.equal(hasRoute, false);
});

// ── impl-11: contact = ContactKit-compatible readiness only (no body/handle/...) ─

test("BoardTemplate-impl-11: no contact BODY / handle / inbox / relay / queue in the lib", () => {
  const src = libSources().join("\n").toLowerCase();
  for (const banned of ["inbox", "relay", "message_body", "messagebody", "counterparty", "phone", "px_inbox", "approval_queue", "contactqueue"]) {
    assert.ok(!src.includes(banned), `Board Templates lib must not reference "${banned}"`);
  }
  // The readiness type carries only the structural kinds — external kinds expose
  // only an externalActionUrl, never a handle/body.
  const types = stripJs(readFileSync(here("./types.ts"), "utf8"));
  const block = types.slice(types.indexOf("PublicContactReadinessV1"), types.indexOf("CONTACT_READINESS_KINDS"));
  for (const banned of ["handle", "phone", "email", "messageBody", "inbox"]) {
    assert.ok(!block.includes(banned), `contact readiness must not carry ${banned}`);
  }
});

// ── impl-12: criteria-pass alone never auto-publishes (structural only) ──────────

test("BoardTemplate-impl-12: the criteria evaluator returns a structural result, never a verdict/score", () => {
  const criteria = stripJs(readFileSync(here("./criteria.ts"), "utf8")).toLowerCase();
  for (const banned of ["quality", "score", "good", "suitab", "verdict", "approve", "auto-publish", "autopublish"]) {
    assert.ok(!criteria.includes(banned), `criteria must not reference "${banned}"`);
  }
});

// ── impl-13: owner-local — the lib makes no network call (draft never leaves device)

test("BoardTemplate-impl-13: the Board Templates lib makes no network call", () => {
  for (const src of libSources()) {
    for (const net of ["fetch(", "XMLHttpRequest", "sendBeacon", "navigator.", "WebSocket", ".post(", "/api/"]) {
      assert.ok(!src.includes(net), `Board Templates lib must not use ${net}`);
    }
  }
});

// ── S1: owner-local substrate is namespace-separated from B memory ───────────────

test("BoardTemplate-impl-S1: the draft store and the B memory store share no IndexedDB namespace", () => {
  const draftDb = readFileSync(here("./indexeddb.ts"), "utf8");
  const memDb = readFileSync(here("../owner-memory/indexeddb.ts"), "utf8");
  const pick = (src: string, re: RegExp) => (src.match(re) ?? [])[1];

  const draftName = pick(draftDb, /DB_NAME = "([^"]+)"/);
  const memName = pick(memDb, /DB_NAME = "([^"]+)"/);
  const draftStore = pick(draftDb, /STORE = "([^"]+)"/);
  const memStore = pick(memDb, /STORE = "([^"]+)"/);
  const draftKey = pick(draftDb, /keyPath: "([^"]+)"/);
  const memKey = pick(memDb, /keyPath: "([^"]+)"/);

  // The concrete namespaces (locks the values so a future rename can't collide them).
  assert.equal(draftName, "px-board-drafts");
  assert.equal(memName, "px-owner-memory");
  assert.equal(draftStore, "drafts");
  assert.equal(memStore, "memory");
  assert.equal(draftKey, "draftId");
  assert.equal(memKey, "memoryId");

  // Every dimension differs — collision is impossible on all axes, not just one.
  assert.notEqual(draftName, memName);
  assert.notEqual(draftStore, memStore);
  assert.notEqual(draftKey, memKey);

  // The id prefixes are disjoint too (draft_/row_ vs mem_).
  assert.ok(/`\$\{prefix\}_\$\{/.test(readFileSync(here("./draft-store.ts"), "utf8")));
  assert.ok(readFileSync(here("../owner-memory/store.ts"), "utf8").includes("`mem_${"));
});

test("BoardTemplate-impl-S1: the Board Templates SOURCE imports no owner-memory / owner-agent", () => {
  // (the boundary-isolation gate in the TEST file imports their constants on purpose;
  //  the runtime source must not — the two owner-local substrates never couple.)
  for (const src of libSources()) {
    assert.ok(!/owner-memory/.test(src), "board-template source must not import owner-memory");
    assert.ok(!/owner-agent/.test(src), "board-template source must not import owner-agent");
  }
});

test("BoardTemplate-impl-S1: the B memory lib and the B+1 proposal lib never read a draft", () => {
  const read = (rel: string) => {
    const out: string[] = [];
    for (const ent of readdirSync(here(rel), { withFileTypes: true })) {
      if (ent.name.endsWith(".ts") && !ent.name.endsWith(".test.ts")) out.push(readFileSync(here(`${rel}/${ent.name}`), "utf8"));
    }
    return out;
  };
  for (const src of [...read("../owner-memory"), ...read("../owner-agent")]) {
    for (const banned of ["board-template", "DraftBoard", "px-board-drafts", "board-drafts"]) {
      assert.ok(!src.includes(banned), `memory/proposal lib must not reference ${banned}`);
    }
  }
});

test("BoardTemplate-impl-S1: a draft cannot become an OwnerMemoryV1 entry (no 'draft' memory kind)", () => {
  // The closed memory kinds carry no 'draft' / 'board' arm — a draft can never be
  // written as a memory entry, so it can never enter B+1 proposal grounding.
  assert.deepEqual([...MEMORY_KINDS], ["saved_filter", "preference", "interest", "note"]);
  assert.ok(!MEMORY_KINDS.includes("draft" as never));
  assert.ok(!MEMORY_KINDS.includes("board" as never));
});

// ── impl-15: titleHint is a placeholder — never written into a stored draft title

test("BoardTemplate-impl-15: instantiate never copies a titleHint into a stored title (source-level)", () => {
  const inst = stripJs(readFileSync(here("./instantiate.ts"), "utf8"));
  // The mapper sets title to "" — there is no `title: r.titleHint` assignment.
  assert.ok(/title:\s*""/.test(inst), "instantiate must set stored title to an empty string");
  assert.ok(!/title:\s*r\.titleHint/.test(inst), "instantiate must NOT auto-fill titleHint into a title");
});
