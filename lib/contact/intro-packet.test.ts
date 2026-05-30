// Tests for the intro packet builder. Run with `node --test`.
//
// Public-only by construction: the packet carries a public title + the plain
// public detail URL + a fixed boilerplate, and nothing else — no owner_handle,
// memory, proposal, query, or PII can enter.

import { test } from "node:test";
import assert from "node:assert/strict";

import { buildIntroPacket, introPacketText, publicBoardUrlFor } from "./index.ts";

test("the packet is built from public material only (exactly three fields)", () => {
  const p = buildIntroPacket({ recordId: "rec-x", title: "Hand-bound notebooks" }, "https://app.px-registry.org");
  assert.deepEqual(Object.keys(p).sort(), ["boilerplate", "publicBoardUrl", "recordTitle"]);
  assert.equal(p.recordTitle, "Hand-bound notebooks");
  assert.equal(p.publicBoardUrl, "https://app.px-registry.org/board/?id=rec-x");
});

test("publicBoardUrl is the plain public detail URL — no memory/session/proposal/query", () => {
  const url = publicBoardUrlFor("https://app.px-registry.org/", "rec-y");
  assert.equal(url, "https://app.px-registry.org/board/?id=rec-y"); // trailing slash stripped
  assert.ok(!/owner|handle|session|memory|proposal|interest|note|token/i.test(url));
});

test("boilerplate (JA + EN) states PX does not settle/broker/recommend", () => {
  const ja = buildIntroPacket({ recordId: "r", title: "T" }, "https://x", "ja").boilerplate;
  assert.ok(ja.includes("PX は決済・仲介・推薦をしません"));
  assert.ok(ja.includes("当事者同士"));
  const en = buildIntroPacket({ recordId: "r", title: "T" }, "https://x", "en").boilerplate;
  assert.ok(/does not handle payment, brokering, or recommendation/i.test(en));
  assert.ok(/between the parties/i.test(en));
});

test("the copyable text is the boilerplate (carries the title + url)", () => {
  const p = buildIntroPacket({ recordId: "rec-z", title: "Stoneware mug" }, "https://x");
  const text = introPacketText(p);
  assert.ok(text.includes("Stoneware mug"));
  assert.ok(text.includes("https://x/board/?id=rec-z"));
});
