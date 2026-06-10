// R1.5 meet surface gates — explicit roll-up. Run with `node --test`.
//
//   M-1  forbidden copy — every label-layer string passes the forbidden scan
//   M-2  forbidden copy — lib/meet + app/meet SOURCES carry no forbidden term
//        (the term list itself, ./forbidden.ts, is excluded from its own scan)
//   M-3  no-io in the UI lane — app/meet + lib/meet sources carry no direct
//        fetch / XHR / localStorage / indexedDB: ALL network and persistence go
//        through the audited lib modules (owner-local store, browser-direct AI,
//        signal client), never inline in a component
//   M-4  non-ranking — no .sort( in app/meet (arrival order is the only order)
//   M-5  law is core-owned — app/meet never hardcodes RIG_LAW text; the law
//        reaches a prompt only through lib/rig's buildOwnerPrompt
//
// Scope note: provider names (anthropic/openai) are banned in lib/rig and
// lib/meet, NOT in the dedicated AI module or its UI — a key screen must name
// the provider the owner connects to.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

import { allMeetCopyStrings } from "./copy.ts";
import { findForbiddenTerm } from "./forbidden.ts";

const root = (rel: string) => new URL(`../../${rel}`, import.meta.url);
const read = (rel: string) => readFileSync(root(rel), "utf8");

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

function sourcesUnder(relDir: string, opts?: { exclude?: readonly string[] }): Array<{ rel: string; code: string }> {
  const out: Array<{ rel: string; code: string }> = [];
  const walk = (dir: string): void => {
    for (const ent of readdirSync(root(dir), { withFileTypes: true })) {
      const rel = `${dir}/${ent.name}`;
      if (ent.isDirectory()) walk(rel);
      else if (
        /\.(ts|tsx)$/.test(ent.name) &&
        !ent.name.endsWith(".test.ts") &&
        !(opts?.exclude ?? []).includes(ent.name)
      ) {
        out.push({ rel, code: stripComments(read(rel)) });
      }
    }
  };
  walk(relDir);
  return out;
}

// ── M-1: label layer passes the forbidden scan ──────────────────────────────────

test("M-1: every meet copy string is free of forbidden terms", () => {
  const strings = allMeetCopyStrings();
  assert.ok(strings.length > 20, "label layer should be non-trivial");
  for (const s of strings) {
    assert.equal(findForbiddenTerm(s), null, `forbidden term in copy: ${s}`);
  }
});

// ── M-2: sources are free of forbidden terms ────────────────────────────────────

test("M-2: lib/meet + app/meet sources carry no forbidden term", () => {
  const files = [
    ...sourcesUnder("lib/meet", { exclude: ["forbidden.ts"] }),
    ...sourcesUnder("app/meet"),
  ];
  assert.ok(files.length >= 2, "scan must see the meet sources");
  for (const { rel, code } of files) {
    const hit = findForbiddenTerm(code);
    assert.equal(hit, null, `${rel} contains forbidden term: ${hit}`);
  }
});

// ── M-3: no direct I/O in the UI lane ───────────────────────────────────────────

test("M-3: app/meet + lib/meet never touch network/persistence directly", () => {
  const banned = [/\bfetch\s*\(/, /XMLHttpRequest/, /localStorage/, /indexedDB/i];
  for (const { rel, code } of [...sourcesUnder("lib/meet"), ...sourcesUnder("app/meet")]) {
    for (const re of banned) {
      assert.ok(!re.test(code), `${rel} must not contain ${re} (use the audited lib modules)`);
    }
  }
});

test("M-3b: lib/meet names no AI provider (provider lives in its own module)", () => {
  for (const { rel, code } of sourcesUnder("lib/meet", { exclude: ["forbidden.ts"] })) {
    for (const re of [/openai/i, /anthropic/i]) {
      assert.ok(!re.test(code), `${rel} must not reference a provider: ${re}`);
    }
  }
});

// ── M-4: non-ranking — arrival order only ───────────────────────────────────────

test("M-4: app/meet contains no .sort( — arrival order is the only order", () => {
  for (const { rel, code } of sourcesUnder("app/meet")) {
    assert.ok(!/\.sort\s*\(/.test(code), `${rel} must not re-order with .sort(`);
  }
});

// ── M-5: the law is core-owned ──────────────────────────────────────────────────

test("M-5: app/meet never hardcodes RIG_LAW text", () => {
  for (const { rel, code } of sourcesUnder("app/meet")) {
    assert.ok(!code.includes("両得"), `${rel} must not inline law rule text`);
    assert.ok(!code.includes("出会いの法"), `${rel} must not inline the law heading`);
  }
});
