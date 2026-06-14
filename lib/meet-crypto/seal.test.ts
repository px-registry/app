// 記憶装置 層3-seal — 封緘の pin。Run with `node --test`（WebCrypto 同梱）。
//
//   SL-1  round-trip: sealPrivateKey → openSealedKey で元の priv 一致
//   SL-2  誤 passphrase は fail-closed: auth error を throw・部分復号ゼロ
//   SL-3  封緘形は opaque: 平文の私有スカラ "d" が sealed に現れない
//   SL-4  passphrase / recovery code の分離（別文字列は別鍵＝開かない）
//   （レーン規律 fetch/storage 禁止は keys.test.ts EK-3 が dir 全体を走査する）

import { test } from "node:test";
import assert from "node:assert/strict";

import { mintEncKeyPair } from "./keys.ts";
import { sealPrivateKey, openSealedKey } from "./seal.ts";

test("SL-1: seal → open round-trips the private JWK", async () => {
  const kp = await mintEncKeyPair();
  const sealed = await sealPrivateKey(kp.priv, "correct horse battery staple");
  assert.equal(sealed.kdf, "PBKDF2");
  assert.equal(sealed.alg, "AES-GCM");
  const back = await openSealedKey(sealed, "correct horse battery staple");
  assert.equal(back.d, kp.priv.d, "the private scalar comes back intact");
  assert.equal(back.x, kp.priv.x);
  assert.equal(back.crv, kp.priv.crv);
});

test("SL-2: a wrong passphrase fails closed (auth error, no partial decrypt)", async () => {
  const kp = await mintEncKeyPair();
  const sealed = await sealPrivateKey(kp.priv, "the right one");
  await assert.rejects(
    () => openSealedKey(sealed, "the wrong one"),
    /authentication failed/,
    "wrong passphrase must throw, never return a partial key",
  );
});

test("SL-2b: a tampered ciphertext fails closed", async () => {
  const kp = await mintEncKeyPair();
  const sealed = await sealPrivateKey(kp.priv, "pw");
  // Flip the FIRST char of the ciphertext (avoid base64 tail no-op flake, EV-2 罠).
  const flipped = (sealed.ciphertext[0] === "A" ? "B" : "A") + sealed.ciphertext.slice(1);
  await assert.rejects(() => openSealedKey({ ...sealed, ciphertext: flipped }, "pw"));
});

test("SL-3: the sealed form is opaque — no plaintext 'd' leaks", async () => {
  const kp = await mintEncKeyPair();
  const sealed = await sealPrivateKey(kp.priv, "pw");
  const json = JSON.stringify(sealed);
  assert.ok(!json.includes('"d"'), "the private scalar must not appear in the sealed object");
  assert.ok(typeof kp.priv.d === "string" && !json.includes(kp.priv.d as string), "the raw scalar value is absent too");
});

test("SL-4: passphrase ≠ recovery code — a different string never opens it", async () => {
  const kp = await mintEncKeyPair();
  const sealed = await sealPrivateKey(kp.priv, "owner-passphrase-A");
  await assert.rejects(() => openSealedKey(sealed, "RECOVERY-CODE-XYZ"));
});
