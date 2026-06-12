// R2 0013 — 鍵レーンの gate。Run with `node --test`（node 18+ は WebCrypto 同梱）。

import { test } from "node:test";
import assert from "node:assert/strict";

import { mintEncKeyPair, isPublicEncJwk, encPubToString, parseEncPub } from "./keys.ts";
import { readFileSync, readdirSync } from "node:fs";

test("EK-1: mint → P-256 pair; public half passes the guard, private half is REFUSED", async () => {
  const kp = await mintEncKeyPair();
  assert.equal(kp.pub.kty, "EC");
  assert.equal(kp.pub.crv, "P-256");
  assert.ok(isPublicEncJwk(kp.pub), "public JWK passes");
  // read d BEFORE the guard assert — assert.ok narrows the type to never after
  const privScalar = kp.priv.d;
  assert.ok(typeof privScalar === "string" && privScalar.length > 0, "private half exists for the device");
  assert.ok(!isPublicEncJwk(kp.priv), "private JWK (carries d) is refused by shape");
});

test("EK-2: transport string strips to the public quartet and round-trips", async () => {
  const kp = await mintEncKeyPair();
  const s = encPubToString(kp.pub);
  assert.ok(!s.includes('"d"'), "serialized form can never carry the private scalar");
  const back = parseEncPub(s);
  assert.ok(back !== null && back.x === kp.pub.x && back.y === kp.pub.y);
  assert.equal(parseEncPub("{broken"), null, "junk degrades to null, never throws");
  assert.equal(parseEncPub(JSON.stringify({ ...kp.pub, d: "leak" })), null, "a smuggled d is refused");
});

test("EK-3: lane discipline — no fetch / localStorage / indexedDB in lib/meet-crypto", () => {
  const root = new URL("./", import.meta.url);
  for (const ent of readdirSync(root, { withFileTypes: true })) {
    if (!ent.name.endsWith(".ts") || ent.name.endsWith(".test.ts")) continue;
    const code = readFileSync(new URL(ent.name, root), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/[^\n]*/g, "");
    assert.ok(!/\bfetch\s*\(/.test(code), `${ent.name} must not fetch`);
    assert.ok(!/localStorage|indexedDB/.test(code), `${ent.name} must not touch storage`);
  }
});
