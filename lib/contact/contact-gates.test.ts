// Contact Kit v1 acceptance gates — explicit roll-up. Run with `node --test`.
//
//   ContactKit-impl-1  IntroPacket public-only ............... intro-packet.test.ts + here
//   ContactKit-impl-2  3 actions device-side / client-only ... here (no network in lib/UI)
//   ContactKit-impl-3  no contact-body server route .......... here (no fetch/POST; no new route)
//   ContactKit-impl-4  no PX inbox / contact table ........... here (migrations grep)
//   ContactKit-impl-5  externalActionUrl sanitize + interstitial . here (UI source)
//   ContactKit-impl-6  tool chooser (Telegram non-default) ... tools.test.ts + here
//   ContactKit-impl-7  UI copy discipline (EN/JA) ............ here
//   ContactKit-impl-8  CONTACT_BOUNDARY + A1/A2/B/B+1 untouched here
//   ContactKit-impl-10 boundary does NOT claim pxHoldsNoLink (C1) here
//   ContactKit-impl-11 IntroPacket = title/url/boilerplate only (C3) here
//   ContactKit-impl-12 openToolTemplate no auto-send / no mailto (C4) here
//   ContactKit-impl-13 tool chooser copy avoids recommended/best/safest (C5) here

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

import {
  buildIntroPacket,
  CONTACT_BOUNDARY,
  allContactCopyStrings,
  TOOL_USE_CASE_GUIDE,
} from "./index.ts";
import { MACHINE_READABLE_BOUNDARY, TRANSACTION_BOUNDARY } from "../board/index.ts";
import { OWNER_MEMORY_BOUNDARY } from "../owner-memory/index.ts";
import { PROPOSAL_BOUNDARY } from "../owner-agent/index.ts";

const here = (rel: string) => new URL(rel, import.meta.url);
const stripJs = (s: string) => s.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
function libSources(): string[] {
  const out: string[] = [];
  for (const ent of readdirSync(here("."), { withFileTypes: true })) {
    if (ent.name.endsWith(".ts") && !ent.name.endsWith(".test.ts")) {
      out.push(stripJs(readFileSync(here(`./${ent.name}`), "utf8")));
    }
  }
  return out;
}
const uiSrc = () => readFileSync(here("../../app/board/ContactKit.tsx"), "utf8");

// ── impl-1 / impl-11: IntroPacket public-only ───────────────────────────────────

test("ContactKit-impl-11: the packet carries only title/url/boilerplate (public-only)", () => {
  const p = buildIntroPacket({ recordId: "rec-x", title: "T" }, "https://app.px-registry.org");
  assert.deepEqual(Object.keys(p).sort(), ["boilerplate", "publicBoardUrl", "recordTitle"]);
  const blob = JSON.stringify(p).toLowerCase();
  for (const banned of ["owner_handle", "ownerhandle", "session", "memoryref", "proposal", "interest", "note", "counterparty"]) {
    assert.ok(!blob.includes(banned), `packet must not carry ${banned}`);
  }
  // The builder's source exposes no path for private fields either.
  const src = stripJs(readFileSync(here("./intro-packet.ts"), "utf8")).toLowerCase();
  for (const banned of ["owner_handle", "ownerhandle", "memoryref", "counterparty", "saved_filter", "session"]) {
    assert.ok(!src.includes(banned), `intro-packet.ts must not reference ${banned}`);
  }
});

// ── impl-2 / impl-3: device-side, no network, no contact-body route ─────────────

test("ContactKit-impl-2/3: the contact lib + UI make no network call", () => {
  for (const src of [...libSources(), stripJs(uiSrc())]) {
    for (const net of ["fetch(", "XMLHttpRequest", "sendBeacon", "WebSocket", ".post(", "axios"]) {
      assert.ok(!src.includes(net), `Contact Kit must not use ${net}`);
    }
  }
});

test("ContactKit-impl-3: this stage adds no contact-body server route", () => {
  // Contact Kit is client-only — it introduces no functions/api/contact route.
  // (A2's GET /api/board/contact is a read-only resolver of a PUBLIC url and is
  // not part of this stage; it receives no body.)
  let hasContactDir = true;
  try {
    readdirSync(here("../../functions/api/contact"));
  } catch {
    hasContactDir = false;
  }
  assert.equal(hasContactDir, false);
});

// ── impl-4: no PX inbox / contact-body table ────────────────────────────────────

test("ContactKit-impl-4: no migration creates an inbox / contact-body / message table", () => {
  for (const ent of readdirSync(here("../../migrations"))) {
    const sql = stripJs(readFileSync(here(`../../migrations/${ent}`), "utf8")).toLowerCase();
    for (const banned of ["inbox", "message_body", "contact_body", "create table contact", "create table message"]) {
      assert.ok(!sql.includes(banned), `${ent} must not create ${banned}`);
    }
  }
});

// ── impl-5: sanitize + interstitial in the UI ───────────────────────────────────

test("ContactKit-impl-5: the UI sanitizes the external URL and shows the interstitial", () => {
  const ui = uiSrc();
  assert.ok(ui.includes("sanitizeExternalActionUrl"), "must sanitize the external URL");
  assert.ok(ui.includes("CONTACT_INTERSTITIAL"), "must show the invite-key interstitial");
});

// ── impl-12: no auto-send, no auto-copy-on-load, no mailto ───────────────────────

test("ContactKit-impl-12: no mailto, no auto-copy on load (explicit actions only)", () => {
  const ui = uiSrc();
  for (const src of [...libSources(), stripJs(ui)]) {
    assert.ok(!src.toLowerCase().includes("mailto"), "no mailto scheme");
  }
  // No useEffect → nothing runs on mount (no clipboard write / open on load).
  assert.ok(!ui.includes("useEffect"), "Contact Kit must do nothing on load");
});

// ── impl-6 / impl-13: tool chooser is a guide, copy avoids ranking words ────────

test("ContactKit-impl-6: Signal leads 1:1 privacy; Telegram is not a 1:1 privacy default", () => {
  const oneToOne = TOOL_USE_CASE_GUIDE.find((g) => g.key === "one_to_one_privacy")!;
  assert.equal(oneToOne.tools[0], "signal");
  assert.ok(!oneToOne.tools.includes("telegram"));
});

test("ContactKit-impl-7/13: UI copy has no recommendation/safety/matching wording (EN/JA)", () => {
  const surface = allContactCopyStrings().join("\n").toLowerCase();
  for (const banned of [
    "recommended", "best ", "safest", "optimal", "popular", "vouch for you",
    "マッチング", "おすすめ", "最適な相手", "信頼できる候補", "安全な相手",
    "pxが選んだ", "人気", "スコア", "認定", "保証", "px がつなぎ", "pxがつなぎ",
  ]) {
    assert.ok(!surface.includes(banned), `forbidden contact copy: "${banned}"`);
  }
});

// ── impl-8 / impl-10: boundary wording (C1) + isolation ─────────────────────────

test("ContactKit-impl-10: CONTACT_BOUNDARY does NOT claim pxHoldsNoLink (C1)", () => {
  assert.ok(!("pxHoldsNoLink" in CONTACT_BOUNDARY), "pxHoldsNoLink was retracted (C1)");
  // It DOES make the genuine claims.
  assert.equal(CONTACT_BOUNDARY.pxHoldsNoContactBody, true);
  assert.equal(CONTACT_BOUNDARY.pxDoesNotGenerateContactLink, true);
  assert.equal(CONTACT_BOUNDARY.ownerControlsExternalDestination, true);
  assert.ok(Object.isFrozen(CONTACT_BOUNDARY));
});

test("ContactKit-impl-8: B+1/B/A2/A1 boundary objects gain no Contact Kit key", () => {
  for (const k of Object.keys(CONTACT_BOUNDARY)) {
    assert.ok(!(k in MACHINE_READABLE_BOUNDARY), `A1 boundary must not gain ${k}`);
    assert.ok(!(k in TRANSACTION_BOUNDARY), `A2 boundary must not gain ${k}`);
    assert.ok(!(k in OWNER_MEMORY_BOUNDARY), `B boundary must not gain ${k}`);
    assert.ok(!(k in PROPOSAL_BOUNDARY), `B+1 boundary must not gain ${k}`);
  }
});
