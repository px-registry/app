// R2 0013 — 封筒の往復 gate。Run with `node --test`.

import { test } from "node:test";
import assert from "node:assert/strict";

import { mintEncKeyPair } from "./keys.ts";
import { sealEnvelope, openEnvelope } from "./envelope.ts";

test("EV-1: seal→open round-trip; only the recipient's private key opens it", async () => {
  const bob = await mintEncKeyPair();
  const eve = await mintEncKeyPair();
  const sealed = await sealEnvelope(bob.pub, "今夜の窯焼き、見に来ますか");
  assert.ok(!JSON.stringify(sealed).includes("今夜"), "plaintext never appears in the sealed form");
  assert.equal(await openEnvelope(bob.priv, sealed), "今夜の窯焼き、見に来ますか");
  assert.equal(await openEnvelope(eve.priv, sealed), null, "a different key opens nothing (null, no throw)");
});

test("EV-2: tamper / junk → null, never a throw (fail-closed)", async () => {
  const bob = await mintEncKeyPair();
  const sealed = await sealEnvelope(bob.pub, "x");
  const flip = (s: string) => s.slice(0, -2) + (s.at(-2) === "A" ? "B" : "A") + s.slice(-1);
  assert.equal(await openEnvelope(bob.priv, { ...sealed, ciphertext: flip(sealed.ciphertext) }), null);
  assert.equal(await openEnvelope(bob.priv, { ...sealed, iv: "%%%" }), null);
  assert.equal(await openEnvelope(bob.priv, { ...sealed, ephPub: "{broken" }), null);
});

test("EV-3: every envelope gets a fresh ephemeral key (no linkage between two letters)", async () => {
  const bob = await mintEncKeyPair();
  const a = await sealEnvelope(bob.pub, "same text");
  const b = await sealEnvelope(bob.pub, "same text");
  assert.notEqual(a.ephPub, b.ephPub, "ephemeral differs");
  assert.notEqual(a.ciphertext, b.ciphertext, "ciphertext differs even for the same text");
});
