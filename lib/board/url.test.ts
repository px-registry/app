// Tests for the external action URL policy. Run with `node --test`.
//
// Fail-closed: only http/https absolute URLs with no control chars survive;
// everything else is dropped so no dangerous link is ever served (hard-req §4).

import { test } from "node:test";
import assert from "node:assert/strict";

import { sanitizeExternalActionUrl } from "./index.ts";

test("http and https owner links pass", () => {
  assert.equal(
    sanitizeExternalActionUrl("https://ito-atelier.example/lots/x"),
    "https://ito-atelier.example/lots/x",
  );
  assert.equal(sanitizeExternalActionUrl("http://x.example/y"), "http://x.example/y");
});

test("dangerous schemes are rejected (XSS/phishing surface)", () => {
  for (const bad of [
    "javascript:alert(1)",
    "JavaScript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "file:///etc/passwd",
    "blob:https://x.example/uuid",
    "vbscript:msgbox(1)",
  ]) {
    assert.equal(sanitizeExternalActionUrl(bad), undefined, `must reject ${bad}`);
  }
});

test("relative strings, non-strings, and empty are rejected (no absolute URL)", () => {
  for (const bad of ["/relative/path", "not a url", "", "   ", null, undefined, 42, {}]) {
    assert.equal(sanitizeExternalActionUrl(bad as unknown), undefined);
  }
});

test("control characters are rejected", () => {
  const withNul = "https://x.example/" + String.fromCharCode(0);
  const withNewline = "https://x.example/\n";
  const withTab = "https://x.example/\t";
  assert.equal(sanitizeExternalActionUrl(withNul), undefined);
  assert.equal(sanitizeExternalActionUrl(withNewline), undefined);
  assert.equal(sanitizeExternalActionUrl(withTab), undefined);
});
