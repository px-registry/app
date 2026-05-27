// Unit tests for lib/webauthn. Run with: npm test (node --test).
//
// Coverage is the load-bearing logic: base64url round-trips, the rpId resolver,
// recovery-code shape, the DER→raw signature conversion, and a full assertion
// verification round-trip using a software P-256 key as a stand-in authenticator
// (sign raw r‖s with Web Crypto, wrap to DER exactly as a real authenticator
// would, then verify).

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  bytesToB64Url,
  b64UrlToBytes,
  sha256Hex,
  sha256Bytes,
  timingSafeEqual,
} from "./encoding.ts";
import { getWebAuthnRpId } from "./rp.ts";
import { generateRecoveryCode, recoveryCodeHash, RECOVERY_ALPHABET } from "./recovery.ts";
import { derToRaw, verifyAssertion } from "./verify.ts";

// ── encoding ──────────────────────────────────────────────────────────────

test("base64url round-trips arbitrary bytes", () => {
  for (const len of [0, 1, 2, 3, 16, 32, 65]) {
    const bytes = new Uint8Array(len);
    crypto.getRandomValues(bytes);
    const round = b64UrlToBytes(bytesToB64Url(bytes));
    assert.deepEqual(round, bytes);
  }
});

test("base64url emits no +, /, or = padding", () => {
  const s = bytesToB64Url(new Uint8Array([0xff, 0xfe, 0xfd, 0xfc]));
  assert.ok(!/[+/=]/.test(s));
});

test("sha256Hex matches the known 'abc' vector", async () => {
  assert.equal(
    await sha256Hex("abc"),
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  );
});

test("timingSafeEqual compares by value and length", () => {
  const a = new Uint8Array([1, 2, 3, 4]);
  const b = new Uint8Array([1, 2, 3, 4]);
  const c = new Uint8Array([1, 2, 3, 5]);
  assert.equal(timingSafeEqual(a, b), true);
  assert.equal(timingSafeEqual(a, c), false);
  assert.equal(timingSafeEqual(a, a.subarray(0, 3)), false);
});

// ── rpId resolution ─────────────────────────────────────────────────────────

test("getWebAuthnRpId scopes the px-registry.org family to the parent", () => {
  assert.equal(getWebAuthnRpId("app.px-registry.org"), "px-registry.org");
  assert.equal(getWebAuthnRpId("mariko.px-registry.org"), "px-registry.org");
  assert.equal(getWebAuthnRpId("px-registry.org"), "px-registry.org");
});

test("getWebAuthnRpId returns localhost for local dev", () => {
  assert.equal(getWebAuthnRpId("localhost"), "localhost");
  assert.equal(getWebAuthnRpId("localhost:3000"), "localhost");
});

test("getWebAuthnRpId returns the exact host for previews", () => {
  assert.equal(getWebAuthnRpId("px-app.pages.dev"), "px-app.pages.dev");
});

// ── recovery code ───────────────────────────────────────────────────────────

test("generateRecoveryCode is XXXX-XXXX-XXXX over the alphabet", () => {
  for (let i = 0; i < 50; i++) {
    const code = generateRecoveryCode();
    assert.match(code, /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    for (const ch of code.replace(/-/g, "")) {
      assert.ok(RECOVERY_ALPHABET.includes(ch), `char ${ch} not in alphabet`);
    }
  }
});

test("recoveryCodeHash is stable and case/space-insensitive", async () => {
  const a = await recoveryCodeHash("ABCD-EFGH-JKMN");
  const b = await recoveryCodeHash("  abcd-efgh-jkmn  ");
  assert.equal(a, b);
  assert.match(a, /^[0-9a-f]{64}$/);
});

// ── DER → raw ────────────────────────────────────────────────────────────────

// Encode one integer in DER (minimal, with a leading 0x00 when the high bit is
// set) — the inverse of toFixed32, used to simulate an authenticator's output.
function derInt(bytes: Uint8Array): Uint8Array {
  let i = 0;
  while (i < bytes.length - 1 && bytes[i] === 0) i++;
  let v = bytes.subarray(i);
  if (v[0] & 0x80) {
    const z = new Uint8Array(v.length + 1);
    z.set(v, 1);
    v = z;
  }
  const out = new Uint8Array(2 + v.length);
  out[0] = 0x02;
  out[1] = v.length;
  out.set(v, 2);
  return out;
}

function rawToDer(raw: Uint8Array): Uint8Array {
  const r = derInt(raw.subarray(0, 32));
  const s = derInt(raw.subarray(32, 64));
  const body = new Uint8Array(r.length + s.length);
  body.set(r, 0);
  body.set(s, r.length);
  const out = new Uint8Array(2 + body.length);
  out[0] = 0x30;
  out[1] = body.length;
  out.set(body, 2);
  return out;
}

test("derToRaw inverts rawToDer for values with high-bit set", () => {
  const raw = new Uint8Array(64);
  raw[0] = 0x80; // r high bit set → DER prepends 0x00
  raw[32] = 0x7f;
  raw[63] = 0x01;
  assert.deepEqual(derToRaw(rawToDer(raw)), raw);
});

test("derToRaw left-pads short integers back to 32 bytes", () => {
  const raw = new Uint8Array(64);
  raw[31] = 0x09; // r is a tiny number → DER drops leading zeros
  raw[62] = 0x01;
  raw[63] = 0x02;
  assert.deepEqual(derToRaw(rawToDer(raw)), raw);
});

// ── full assertion verification round-trip ───────────────────────────────────

async function makeAssertion(opts: {
  rpId: string;
  origin: string;
  challenge: Uint8Array;
  flags?: number;
}) {
  const kp = (await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"],
  )) as CryptoKeyPair;
  const jwk = await crypto.subtle.exportKey("jwk", kp.publicKey);

  const rpIdHash = await sha256Bytes(new TextEncoder().encode(opts.rpId));
  const authData = new Uint8Array(37);
  authData.set(rpIdHash, 0);
  authData[32] = opts.flags ?? 0x01; // user-present
  // counter (33..36) left zero

  const clientData = JSON.stringify({
    type: "webauthn.get",
    challenge: bytesToB64Url(opts.challenge),
    origin: opts.origin,
  });
  const clientDataBytes = new TextEncoder().encode(clientData);
  const clientDataHash = await sha256Bytes(clientDataBytes);

  const signed = new Uint8Array(authData.length + clientDataHash.length);
  signed.set(authData, 0);
  signed.set(clientDataHash, authData.length);

  const rawSig = new Uint8Array(
    await crypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      kp.privateKey,
      signed,
    ),
  );

  return {
    publicKeyJwk: jwk,
    clientDataJsonB64: bytesToB64Url(clientDataBytes),
    authenticatorDataB64: bytesToB64Url(authData),
    signatureB64: bytesToB64Url(rawToDer(rawSig)),
  };
}

const RP = "localhost";
const ORIGIN = "http://localhost:3000";

test("verifyAssertion accepts a valid assertion", async () => {
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const a = await makeAssertion({ rpId: RP, origin: ORIGIN, challenge });
  const res = await verifyAssertion({
    ...a,
    expectedChallengeB64: bytesToB64Url(challenge),
    allowedOrigins: [ORIGIN],
  });
  assert.deepEqual(res, { ok: true });
});

test("verifyAssertion rejects a mismatched challenge", async () => {
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const a = await makeAssertion({ rpId: RP, origin: ORIGIN, challenge });
  const res = await verifyAssertion({
    ...a,
    expectedChallengeB64: bytesToB64Url(crypto.getRandomValues(new Uint8Array(32))),
    allowedOrigins: [ORIGIN],
  });
  assert.deepEqual(res, { ok: false, reason: "challenge_mismatch" });
});

test("verifyAssertion rejects a wrong origin", async () => {
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const a = await makeAssertion({ rpId: RP, origin: "https://evil.example", challenge });
  const res = await verifyAssertion({
    ...a,
    expectedChallengeB64: bytesToB64Url(challenge),
    allowedOrigins: [ORIGIN],
  });
  assert.deepEqual(res, { ok: false, reason: "origin_mismatch" });
});

test("verifyAssertion rejects a wrong rpId", async () => {
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const a = await makeAssertion({ rpId: "px-registry.org", origin: ORIGIN, challenge });
  const res = await verifyAssertion({
    ...a,
    expectedChallengeB64: bytesToB64Url(challenge),
    allowedOrigins: [ORIGIN],
  });
  assert.deepEqual(res, { ok: false, reason: "rp_id_mismatch" });
});

test("verifyAssertion rejects when user-present flag is clear", async () => {
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const a = await makeAssertion({ rpId: RP, origin: ORIGIN, challenge, flags: 0x00 });
  const res = await verifyAssertion({
    ...a,
    expectedChallengeB64: bytesToB64Url(challenge),
    allowedOrigins: [ORIGIN],
  });
  assert.deepEqual(res, { ok: false, reason: "user_not_present" });
});

test("verifyAssertion rejects a tampered signature", async () => {
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const a = await makeAssertion({ rpId: RP, origin: ORIGIN, challenge });
  // Flip the last byte of the (raw) r‖s before re-DER-encoding so it stays a
  // well-formed DER signature but no longer verifies.
  const der = b64UrlToBytes(a.signatureB64);
  const raw = derToRaw(der);
  raw[63] ^= 0x01;
  const res = await verifyAssertion({
    ...a,
    signatureB64: bytesToB64Url(rawToDer(raw)),
    expectedChallengeB64: bytesToB64Url(challenge),
    allowedOrigins: [ORIGIN],
  });
  assert.deepEqual(res, { ok: false, reason: "signature_invalid" });
});
