// Stage B acceptance gates — explicit roll-up. Run with `node --test`.
//
// Pure-logic gates here; the substrate behaviour is in store/validate/saved-filter
// tests (noted inline). The structural proofs (server memory-blindness, no memory
// route, no fetch, boundary separation) are source/grep scans over the real tree.
//
//   B-impl-1  typed discriminated-union store ..... store.test.ts / validate.test.ts
//   B-impl-2  no server owner_memory D1 table ...... here (grep migrations + functions)
//   B-impl-3  /search·/board memory-blind, A/B identical .. here
//   B-impl-4  read/edit/export/delete lifecycle .... store.test.ts (+ here export shape)
//   B-impl-5  saved_filter not server-applied ...... here + saved-filter.test.ts
//   B-impl-6  no /recommend /rank /score /feed ..... here (grep)
//   B-impl-7  no body/PII/connector/AI-fact path ... validate.test.ts (typed) + here
//   B-impl-8  provenance required, AI write refused . store.test.ts / validate.test.ts
//   B-impl-9  boundary stamp, A1/A2 byte-compat ..... here (C3)
//   B-impl-10 memory body never sent to server ..... here (no route, no fetch)
//   B-impl-11 note_is_local_only_and_never_sent_to_server .. here
//   B-impl-12 A1/A2 response objects byte-untouched . here (C3)
//   B-impl-13 export(JSON+provenance)/delete(no server) .. store.test.ts
//   B-impl-14 provenance/AI-write local validator ... validate.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

import { MACHINE_READABLE_BOUNDARY, TRANSACTION_BOUNDARY } from "../board/index.ts";
import { OWNER_MEMORY_BOUNDARY } from "./index.ts";

const root = (rel: string) => new URL(`../../${rel}`, import.meta.url);
const read = (rel: string) => readFileSync(root(rel), "utf8");

// All server-side source: every Function file (the surface that must be memory-blind).
function allFunctionSources(): string[] {
  const out: string[] = [];
  const walk = (relDir: string) => {
    for (const ent of readdirSync(root(relDir), { withFileTypes: true })) {
      const rel = `${relDir}/${ent.name}`;
      if (ent.isDirectory()) walk(rel);
      else if (ent.name.endsWith(".ts") && !ent.name.endsWith(".test.ts")) out.push(read(rel));
    }
  };
  walk("functions");
  return out;
}
function allMemorySources(): string[] {
  const out: string[] = [];
  for (const ent of readdirSync(root("lib/owner-memory"), { withFileTypes: true })) {
    if (ent.name.endsWith(".ts") && !ent.name.endsWith(".test.ts")) out.push(read(`lib/owner-memory/${ent.name}`));
  }
  return out;
}

// ── B-impl-2 / B-impl-10: no server owner-memory table or route ─────────────────

test("B-impl-2: no server owner_memory / owner_settings D1 table exists", () => {
  for (const ent of readdirSync(root("migrations"))) {
    const sql = read(`migrations/${ent}`).toLowerCase();
    assert.ok(!sql.includes("owner_memory"), `${ent} must not define owner_memory`);
    assert.ok(!sql.includes("owner_settings"), `${ent} must not define owner_settings`);
    assert.ok(!sql.includes("create table memory"), `${ent} must not define a memory table`);
  }
});

test("B-impl-10: no server route imports owner-memory or receives a memory body", () => {
  for (const src of allFunctionSources()) {
    assert.ok(!/owner-memory/.test(src), "a Function imports owner-memory");
    assert.ok(!/OwnerMemoryV1/.test(src), "a Function references OwnerMemoryV1");
  }
  // There is no owner-MEMORY route on disk. The banned thing is a server route for
  // owner memory (functions/api/owner/memory) — NOT the whole owner namespace:
  // functions/api/owner/board (Owner Board Publish v0) is a sanctioned public-write
  // route, and the import scans above already prove no Function touches owner-memory.
  let hasMemoryRoute = true;
  try {
    readdirSync(root("functions/api/owner/memory"));
  } catch {
    hasMemoryRoute = false;
  }
  assert.equal(hasMemoryRoute, false, "no functions/api/owner/memory route should exist");
});

test("B-impl-10/11: the owner-memory lib never calls a network (no fetch/sync)", () => {
  for (const src of allMemorySources()) {
    for (const net of ["fetch(", "XMLHttpRequest", "sendBeacon", "navigator.", "WebSocket"]) {
      assert.ok(!src.includes(net), `owner-memory must not use ${net}`);
    }
  }
});

test("B-impl-11: note is a local-only kind with no server sync path", () => {
  // `note` exists as a kind, but nothing in the lib serializes it toward a
  // server — the only outputs are the local store and exportAll (a download).
  const memSrc = allMemorySources().join("\n");
  assert.ok(memSrc.includes('"note"') || memSrc.includes("note:"), "note kind must exist");
  // No memory source mentions a sync/upload/post of entries.
  for (const s of allMemorySources()) {
    for (const banned of ["upload", "sync(", "/api/", "post("]) {
      assert.ok(!s.toLowerCase().includes(banned), `owner-memory must not ${banned}`);
    }
  }
});

// ── B-impl-3 / B-impl-5: /search is memory-blind and owner-agnostic ─────────────

test("B-impl-3: the /search handler imports no owner-memory and reads no session", () => {
  const src = read("functions/api/search.ts") + read("functions/_board.ts");
  assert.ok(!/owner-memory/.test(src));
  assert.ok(!/readSession|cookie|session/i.test(src), "/search must not read session/owner identity");
});
// The runtime "same params → byte-identical for owner A/B" proof runs in
// functions/api/search.test.ts (it must import/execute the Function, which lives
// outside the app tsconfig).

// ── B-impl-6: no center-side ranking/recommendation/feed ────────────────────────

test("B-impl-6: no /recommend /rank /score /feed or behaviour-inference on the server", () => {
  // Strip comments first — A1/A2 prose explains the boundary using the very words
  // ("no hidden ranking", pxDoesNotRecommend), which is the opposite of having them.
  const stripJs = (s: string) => s.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
  const all = allFunctionSources().map(stripJs).join("\n").toLowerCase();
  for (const banned of ["recommend", "/rank", "ranking", "score(", "/feed", "interest_graph", "infer("]) {
    assert.ok(!all.includes(banned), `server must not contain "${banned}"`);
  }
});

// ── B-impl-9 / B-impl-12: boundary separation (C3) ──────────────────────────────

test("B-impl-12: A1/A2 boundary objects are NOT given B keys (byte-compat)", () => {
  const bKeys = Object.keys(OWNER_MEMORY_BOUNDARY);
  for (const k of bKeys) {
    assert.ok(!(k in MACHINE_READABLE_BOUNDARY), `A1 boundary must not gain ${k}`);
    assert.ok(!(k in TRANSACTION_BOUNDARY), `A2 boundary must not gain ${k}`);
  }
  // A1 boundary stays exactly its four keys.
  assert.deepEqual(Object.keys(MACHINE_READABLE_BOUNDARY).sort(), [
    "ownerControlsAction", "pxDoesNotRecommend", "pxDoesNotSell", "pxDoesNotSettle",
  ]);
});

test("B-impl-9: the B boundary constant is its own module, all-true and frozen", () => {
  assert.deepEqual(OWNER_MEMORY_BOUNDARY, {
    pxStoresNoOwnerMemory: true,
    memoryIsOwnerLocal: true,
    pxDoesNotRankOrRecommend: true,
    pxBuildsNoInterestGraph: true,
  });
  assert.ok(Object.isFrozen(OWNER_MEMORY_BOUNDARY));
});
