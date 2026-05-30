// Tests for the tool chooser. Run with `node --test`.
//
// A use-case guide, not a ranking. No email/mailto. Signal is the 1:1 privacy
// example (Telegram is not), SimpleX leads advanced privacy, LINE is OpenChat.

import { test } from "node:test";
import assert from "node:assert/strict";

import { TOOL_KINDS, TOOL_USE_CASE_GUIDE, toolOpenUrl } from "./index.ts";
import type { ToolKind } from "./index.ts";

test("there is no email/mailto tool (contact is in-app)", () => {
  assert.ok(!(TOOL_KINDS as readonly string[]).includes("email"));
  assert.ok(!(TOOL_KINDS as readonly string[]).includes("mailto"));
});

test("every tool open URL is http/https or null (no mailto/custom scheme)", () => {
  for (const t of TOOL_KINDS) {
    const url = toolOpenUrl(t as ToolKind);
    if (url !== null) assert.match(url, /^https?:\/\//, `${t} open URL must be http/https`);
  }
});

test("1:1 privacy guide leads with Signal and never Telegram", () => {
  const oneToOne = TOOL_USE_CASE_GUIDE.find((g) => g.key === "one_to_one_privacy")!;
  assert.equal(oneToOne.tools[0], "signal");
  assert.ok(!oneToOne.tools.includes("telegram"), "Telegram must not be a 1:1 privacy example");
});

test("advanced privacy leads with SimpleX; group use cases use LINE OpenChat (not direct)", () => {
  const adv = TOOL_USE_CASE_GUIDE.find((g) => g.key === "privacy_advanced")!;
  assert.equal(adv.tools[0], "simplex");
  const casual = TOOL_USE_CASE_GUIDE.find((g) => g.key === "one_to_many_casual")!;
  assert.ok(casual.tools.includes("line_openchat"));
  assert.ok(!(TOOL_KINDS as readonly string[]).includes("line_direct"));
});
