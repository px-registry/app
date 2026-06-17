// PX Device Mesh — 鍵と署名の crypto 正当性（verdict G1/G2 の足回り）。Run: node --test
//
// クライアント署名（lib/meet-crypto/mesh）と **実サーバ検証**（functions/_mesh）の round-trip を
// 突き合わせる。鍵生成・署名・偽造拒否・private('d') 拒否・形ガード。

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

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
  buildHandoffQR,
  parseHandoffQR,
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

// ── Phase B: QR 束縛 handoff（verdict G1）─────────────────────────────────────────

async function newDeviceQR(now: number, ttlMs = 72 * 3600 * 1000, name?: string) {
  const keys = await mintDeviceKeys();
  const did = mintDeviceId();
  const qr = await buildHandoffQR(did, encPubToString(keys.enc.pub), encPubToString(keys.sig.pub), keys.sig.priv, now + ttlMs, name);
  return { keys, did, qr };
}

test("DM-handoff 1: build → parse round-trip（形・期限・QR 署名すべて通る）", async () => {
  const now = 1_700_000_000_000;
  const { did, qr } = await newDeviceQR(now, 72 * 3600 * 1000, "MacBook");
  const parsed = await parseHandoffQR(JSON.stringify(qr), now);
  assert.notEqual(parsed, null, "valid QR parses");
  assert.equal(parsed?.did, did);
  assert.equal(parsed?.name, "MacBook");
  assert.equal(parsed?.encPub, qr.encPub, "封緘宛先 encPub は QR の値");
});

test("DM-handoff 2: 期限切れ QR は拒否（null）", async () => {
  const now = 1_700_000_000_000;
  const { qr } = await newDeviceQR(now, -1000); // exp は now より前
  assert.equal(await parseHandoffQR(JSON.stringify(qr), now), null, "expired QR refused");
});

test("DM-handoff 3: QR 署名改竄は拒否（encPub 差し替え → 署名不一致）", async () => {
  const now = 1_700_000_000_000;
  const a = await newDeviceQR(now);
  const b = await newDeviceQR(now);
  // server/network が encPub を別端末の鍵に差し替えた想定 — QR 署名が合わなくなる。
  const tampered = { ...a.qr, encPub: b.qr.encPub };
  assert.equal(await parseHandoffQR(JSON.stringify(tampered), now), null, "swapped encPub fails QR signature");
  // sig 自体の改竄も拒否。
  const tamperedSig = { ...a.qr, sig: b.qr.sig };
  assert.equal(await parseHandoffQR(JSON.stringify(tamperedSig), now), null, "swapped signature refused");
});

test("DM-handoff 4: sigPub 差し替え（別鍵での検証）は拒否", async () => {
  const now = 1_700_000_000_000;
  const a = await newDeviceQR(now);
  const b = await newDeviceQR(now);
  const swapped = { ...a.qr, sigPub: b.qr.sigPub }; // 別鍵で検証 → a.sig は通らない
  assert.equal(await parseHandoffQR(JSON.stringify(swapped), now), null, "verifying with a foreign sigPub fails");
});

test("DM-handoff 5: handoff は QR encPub にだけ封緘する（server 後取得鍵を信頼起点にしない・G1）", () => {
  const src = readFileSync(new URL("../meet-mesh/handoff.ts", import.meta.url), "utf8");
  const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  assert.ok(/parseEncPub\(\s*qr\.encPub\s*\)/.test(code), "封緘宛先は QR encPub");
  // recipient の公開鍵を server から後取得する経路を持たない（差し替え不可の構造的担保）。
  assert.ok(!/meshGet/.test(code), "no meshGet (server-fetched key) in handoff");
  assert.ok(!/getEpochPub/.test(code), "no getEpochPub for the recipient in handoff");
  assert.ok(!/enckey/i.test(code), "no enckey fetch in handoff");
});
