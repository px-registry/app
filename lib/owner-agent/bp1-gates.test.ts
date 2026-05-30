// Stage B+1 acceptance gates — explicit roll-up. Run with `node --test`.
//
//   Bplus1-impl-1  owner-side memory read (no network for memory) .. orchestrator (client) + here (lib has no net)
//   Bplus1-impl-2  ProposalV1 typed + grounded, no opaque score ..... propose.test.ts + here
//   Bplus1-impl-3  owner-side composition; board via neutral params .. mapper.test.ts
//   Bplus1-impl-4  memory/proposal/reason not sent to PX ............. here (mapper allowlist + no net)
//   Bplus1-impl-5  /search memory-blind A/B identical (regression) ... functions/api/search.test.ts
//   Bplus1-impl-6  agent does not write memory ....................... here (no store-write import)
//   Bplus1-impl-7  agent does not auto-act / auto-transact .......... here (grep)
//   Bplus1-impl-8  A1/A2/B boundary byte-untouched ................... here
//   Bplus1-impl-9  no external LLM / no PX-central ranking .......... here (grep)
//   Bplus1-impl-10 thin-honest copy, no forbidden field/copy ........ here + propose.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

import {
  memoryToSearchParams,
  PROPOSAL_BOUNDARY,
  PROPOSAL_REASON_LABELS,
  allProposalCopyStrings,
} from "./index.ts";
import { MACHINE_READABLE_BOUNDARY, TRANSACTION_BOUNDARY } from "../board/index.ts";
import { OWNER_MEMORY_BOUNDARY } from "../owner-memory/index.ts";
import type { OwnerMemoryV1 } from "../owner-memory/index.ts";

const here = (rel: string) => new URL(rel, import.meta.url);
const stripJs = (s: string) => s.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");

/** All non-test B+1 lib sources, comment-stripped. */
function agentSources(): string[] {
  const out: string[] = [];
  for (const ent of readdirSync(here("."), { withFileTypes: true })) {
    if (ent.name.endsWith(".ts") && !ent.name.endsWith(".test.ts")) {
      out.push(stripJs(readFileSync(here(`./${ent.name}`), "utf8")));
    }
  }
  return out;
}

// ── Cbp1-1 / Bplus1-impl-4: only saved_filter becomes a server param ────────────

test("Bplus1-impl-4: interest/note/preference never become /search params", () => {
  const base = { memoryId: "m", createdAt: "t", updatedAt: "t", provenance: "owner_written" } as const;
  const nonFilter: OwnerMemoryV1[] = [
    { ...base, kind: "interest", value: { label: "x" } },
    { ...base, kind: "note", value: { text: "x" } },
    { ...base, kind: "preference", value: { displayDensity: "compact" } },
  ];
  for (const e of nonFilter) assert.equal(memoryToSearchParams(e, { includeQuery: true }), null);
});

// ── narrowing: zero matching dependency in the proposal road ────────────────────

test("matching-dependency-zero: no 'matching' literal in the proposal lib runtime", () => {
  // Comment-stripped: the agent road carries no matching surface anywhere.
  const src = agentSources().join("\n").toLowerCase();
  assert.ok(!src.includes("matching"), "proposal lib must not reference matching");
});

// ── Cbp1-3: reason kinds are exactly two (preference dropped) ────────────────────

test("Bplus1-impl-2: ProposalReason kinds are the grounded set (no matches_preference)", () => {
  // #4 added cross_intent_candidate (also grounded in a named memoryRef). preference
  // is still NOT a basis for choosing a listing (Cbp1-3).
  assert.deepEqual(Object.keys(PROPOSAL_REASON_LABELS).sort(), [
    "cross_intent_candidate",
    "matches_saved_filter",
    "matches_saved_interest",
  ]);
  const src = agentSources().join("\n");
  assert.ok(!src.includes("matches_preference"), "matches_preference must not exist");
});

// ── Cbp1-4 / Bplus1-impl-6/7: proposal-only — no memory write, no auto-act ───────

test("Bplus1-impl-6: the proposal lib imports no memory WRITE API", () => {
  for (const src of agentSources()) {
    assert.ok(!src.includes("OwnerMemoryStore"), "agent must not import the store (which has writes)");
    for (const w of [".create(", ".update(", ".remove(", ".put(", ".clear("]) {
      assert.ok(!src.includes(w), `agent must not call ${w}`);
    }
  }
});

test("Bplus1-impl-7: no auto-action / auto-transact / auto-apply in the proposal lib", () => {
  const src = agentSources().join("\n").toLowerCase();
  for (const banned of ["autoapply", "autoact", "autotransact", "auto_apply", "auto_act"]) {
    assert.ok(!src.includes(banned), `agent must not contain ${banned}`);
  }
});

// ── Cbp1-5 / Bplus1-impl-9: no external model, no network, no central ranking ────

test("Bplus1-impl-9: no external LLM/model adapter in the proposal lib", () => {
  const src = agentSources().join("\n").toLowerCase();
  for (const banned of ["openai", "anthropic", "ollama", "llm", "gpt-", "chatcompletion", "embedding", "model adapter"]) {
    assert.ok(!src.includes(banned), `agent must not reference ${banned}`);
  }
});

test("Bplus1-impl-1/9: the proposal lib makes no network call (memory stays local)", () => {
  for (const src of agentSources()) {
    for (const net of ["fetch(", "XMLHttpRequest", "sendBeacon", "WebSocket", "/recommend", "/rank", "/score", "/feed"]) {
      assert.ok(!src.includes(net), `agent must not use ${net}`);
    }
  }
});

// ── §5 / Bplus1-impl-8: boundary byte-untouched ─────────────────────────────────

test("Bplus1-impl-8: B+1 boundary keys do NOT leak into A1/A2/B boundary objects", () => {
  for (const k of Object.keys(PROPOSAL_BOUNDARY)) {
    assert.ok(!(k in MACHINE_READABLE_BOUNDARY), `A1 boundary must not gain ${k}`);
    assert.ok(!(k in TRANSACTION_BOUNDARY), `A2 boundary must not gain ${k}`);
    assert.ok(!(k in OWNER_MEMORY_BOUNDARY), `B boundary must not gain ${k}`);
  }
  // A1 four keys / B four keys remain exactly as they were.
  assert.deepEqual(Object.keys(MACHINE_READABLE_BOUNDARY).sort(), [
    "ownerControlsAction", "pxDoesNotRecommend", "pxDoesNotSell", "pxDoesNotSettle",
  ]);
  assert.deepEqual(Object.keys(OWNER_MEMORY_BOUNDARY).sort(), [
    "memoryIsOwnerLocal", "pxBuildsNoInterestGraph", "pxDoesNotRankOrRecommend", "pxStoresNoOwnerMemory",
  ]);
});

// ── copy / field guard (Bplus1-impl-10) ─────────────────────────────────────────

test("Bplus1-impl-10: proposal copy contains no PX-recommendation wording", () => {
  const surface = allProposalCopyStrings().join("\n").toLowerCase();
  for (const banned of [
    "recommended", "popular", "best ", "top candidate", "optimi",
    "おすすめ", "最適", "スコア", "信頼度", "人気", "あなたに合う順", "上位候補",
    "最適な相手", "信頼できる候補", "pxが選んだ", "aiが学習",
  ]) {
    assert.ok(!surface.includes(banned), `forbidden copy present: "${banned}"`);
  }
});

test("Bplus1-impl-10: no rank/score/priority/confidence field in the proposal types", () => {
  const types = readFileSync(here("./types.ts"), "utf8");
  // ProposalV1 declares only the three allowed members.
  const body = types.slice(types.indexOf("interface ProposalV1"), types.indexOf("/** The minimal"));
  for (const banned of ["score", "rank", "priority", "confidence", "best", "weight", "popular"]) {
    assert.ok(!body.includes(banned), `ProposalV1 must not declare ${banned}`);
  }
});
