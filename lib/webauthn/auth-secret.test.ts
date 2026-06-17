// Auth secret fail-closed rule (Hiroto gate 2026-06-17). Run: node --test
//
// Production MUST fail-closed when AUTH_SECRET is absent — never silently fall
// back to the known DEV_SECRET (which would let anyone forge a session and
// collapse the passkey identity root).

import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveAuthSecret, DEV_SECRET } from "./auth-secret.ts";

test("AS-1: AUTH_SECRET set → used (production / configured)", () => {
  assert.equal(resolveAuthSecret({ AUTH_SECRET: "real-prod-secret" }), "real-prod-secret");
  // AUTH_SECRET wins even if the dev marker is also (mistakenly) present.
  assert.equal(resolveAuthSecret({ AUTH_SECRET: "real", ALLOW_DEV_SECRET: "1" }), "real");
});

test("AS-2: no AUTH_SECRET + ALLOW_DEV_SECRET=1 → DEV_SECRET (local/dev only)", () => {
  assert.equal(resolveAuthSecret({ ALLOW_DEV_SECRET: "1" }), DEV_SECRET);
});

test("AS-3: no AUTH_SECRET + no marker → null (production fail-closed)", () => {
  assert.equal(resolveAuthSecret({}), null, "prod with no secret rejects everything");
  assert.equal(resolveAuthSecret({ AUTH_SECRET: "" }), null, "empty AUTH_SECRET is not a secret");
  assert.equal(resolveAuthSecret({ ALLOW_DEV_SECRET: "0" }), null, "only '1' enables the dev fallback");
  assert.equal(resolveAuthSecret({ ALLOW_DEV_SECRET: "true" }), null, "non-'1' marker does not enable DEV_SECRET");
});
