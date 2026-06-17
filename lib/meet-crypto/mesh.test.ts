// PX Device Mesh — 鍵と署名の crypto 正当性（verdict G1/G2 の足回り）。Run: node --test
//
// クライアント署名（lib/meet-crypto/mesh）と **実サーバ検証**（functions/_mesh）の round-trip を
// 突き合わせる。鍵生成・署名・偽造拒否・private('d') 拒否・形ガード。

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  mintDeviceKeys,
  mintOwnerRef,
  mintDeviceId,
  mintPayloadId,
  signMesh,
  isPublicSigJwk,
  jwkFingerprint,
  verifyMeshSig,
  isOwnerRef,
  isDeviceId,
  isMeshPayloadId,
  validPubStr,
} from "./mesh.ts";
import { mintEncKeyPair, parseEncPub, encPubToString } from "./keys.ts";

test("DM-crypto 1: signMesh ↔ verifyMeshSig round-trip", async () => {
  const { sig } = await mintDeviceKeys();
  const dataStr = JSON.stringify({ targetDeviceId: "dev_0011223344556677", newEpochPub: "x" });
  const ts = 1_700_000_000_000;
  const s = await signMesh(sig.priv, dataStr, ts);
  assert.equal(await verifyMeshSig(sig.pub, s, dataStr, ts), true, "valid signature verifies");
  // tamper: changed ts / data / signature all fail
  assert.equal(await verifyMeshSig(sig.pub, s, dataStr, ts + 1), false, "different ts fails");
  assert.equal(await verifyMeshSig(sig.pub, s, dataStr + " ", ts), false, "tampered data fails");
});

test("DM-crypto 2: a signature from another key is rejected (forgery)", async () => {
  const a = await mintDeviceKeys();
  const b = await mintDeviceKeys();
  const dataStr = "{}";
  const ts = 1_700_000_000_000;
  const sigByB = await signMesh(b.sig.priv, dataStr, ts);
  assert.equal(await verifyMeshSig(a.sig.pub, sigByB, dataStr, ts), false, "A's pub must not verify B's signature");
});

test("DM-crypto 3: device enc/sig pubs are PUBLIC only (no 'd'); priv carries 'd'", async () => {
  const { sig, enc } = await mintDeviceKeys();
  assert.equal(isPublicSigJwk(sig.pub), true, "sig pub is public shape");
  assert.equal(isPublicSigJwk(sig.priv), false, "sig priv (has d) is refused");
  assert.equal(isPublicSigJwk(enc.pub), true, "enc pub is public shape");
  assert.equal(isPublicSigJwk(enc.priv), false, "enc priv (has d) is refused");
  // server validPubStr also refuses a private-bearing JWK string
  assert.equal(validPubStr(encPubToString(sig.pub)), true, "public JWK string passes");
  assert.equal(validPubStr(JSON.stringify(sig.priv)), false, "private JWK string rejected");
});

test("DM-crypto 4: minted ids match the server shape guards", async () => {
  for (let i = 0; i < 5; i++) {
    assert.equal(isOwnerRef(mintOwnerRef()), true, "owner_ref = 32 hex");
    assert.equal(isDeviceId(mintDeviceId()), true, "device_id = dev_16hex");
    assert.equal(isMeshPayloadId(mintPayloadId()), true, "payload_id = mesh_16hex");
  }
  assert.equal(isOwnerRef("dev_0011223344556677"), false);
  assert.equal(isDeviceId("0011223344556677"), false);
});

test("DM-crypto 5: epoch keypair is ECDH P-256 and serializes public-only", async () => {
  const ep = await mintEncKeyPair();
  const pubStr = encPubToString(ep.pub);
  assert.notEqual(parseEncPub(pubStr), null, "epoch pub parses as public JWK");
  assert.equal(JSON.parse(pubStr).d, undefined, "no private scalar in serialized epoch pub");
});

test("DM-crypto 6: jwkFingerprint is deterministic 64-hex over public coords", async () => {
  const { sig } = await mintDeviceKeys();
  const f1 = await jwkFingerprint(sig.pub);
  const f2 = await jwkFingerprint(sig.pub);
  assert.equal(f1, f2, "deterministic");
  assert.match(f1, /^[0-9a-f]{64}$/, "sha-256 hex");
});
