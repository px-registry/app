// Server-side WebAuthn assertion verification (Web Crypto).
//
// Runs in the Pages Function (Workers runtime) and in node --test. Given a
// stored ES256 public key (JWK) and the four assertion artifacts, it:
//   1. parses clientDataJSON and checks type / challenge / origin,
//   2. checks the authenticatorData rpIdHash and the user-present flag,
//   3. reconstructs the signed message (authenticatorData ‖ SHA-256(clientData)),
//   4. converts the DER ECDSA signature to the raw r‖s form Web Crypto wants,
//   5. verifies the signature.
//
// The DER→raw step is the load-bearing subtlety: authenticators emit an ASN.1
// DER-encoded ECDSA signature, but crypto.subtle.verify for ECDSA expects the
// IEEE-P1363 fixed-width r‖s concatenation. Skipping the conversion is the
// classic "valid passkey, signature_invalid" bug.

import {
  b64UrlToBytes,
  bytesToUtf8,
  sha256Bytes,
} from "./encoding.ts";
import { getWebAuthnRpId } from "./rp.ts";
import type { VerifyParams, VerifyResult } from "./types.ts";

/** Strip a base64url string of any padding for a stable equality check. */
function normB64Url(s: string): string {
  return s.replace(/=+$/, "");
}

/** Left-trim leading zero bytes, then assert it fits in 32 bytes (P-256). */
function toFixed32(b: Uint8Array): Uint8Array {
  let i = 0;
  while (i < b.length - 1 && b[i] === 0) i++;
  const trimmed = b.subarray(i);
  if (trimmed.length > 32) throw new Error("integer too long for P-256");
  return trimmed;
}

/**
 * Convert an ASN.1 DER ECDSA signature (SEQUENCE { INTEGER r, INTEGER s }) into
 * the raw 64-byte r‖s form. Throws on malformed input.
 */
export function derToRaw(der: Uint8Array): Uint8Array {
  let offset = 0;
  if (der[offset++] !== 0x30) throw new Error("bad DER: expected SEQUENCE");
  // SEQUENCE length (short or long form) — value is unused, we walk the members.
  let seqLen = der[offset++];
  if (seqLen & 0x80) {
    const n = seqLen & 0x7f;
    seqLen = 0;
    for (let i = 0; i < n; i++) seqLen = (seqLen << 8) | der[offset++];
  }

  if (der[offset++] !== 0x02) throw new Error("bad DER: expected INTEGER r");
  const rLen = der[offset++];
  const r = der.subarray(offset, offset + rLen);
  offset += rLen;

  if (der[offset++] !== 0x02) throw new Error("bad DER: expected INTEGER s");
  const sLen = der[offset++];
  const s = der.subarray(offset, offset + sLen);
  offset += sLen;

  const rFixed = toFixed32(r);
  const sFixed = toFixed32(s);
  const out = new Uint8Array(64);
  out.set(rFixed, 32 - rFixed.length);
  out.set(sFixed, 64 - sFixed.length);
  return out;
}

async function importVerifyKey(jwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["verify"],
  );
}

interface ClientData {
  type: string;
  challenge: string;
  origin: string;
}

export async function verifyAssertion(
  params: VerifyParams,
): Promise<VerifyResult> {
  const {
    publicKeyJwk,
    clientDataJsonB64,
    authenticatorDataB64,
    signatureB64,
    expectedChallengeB64,
    allowedOrigins,
  } = params;

  // 1. clientDataJSON
  let clientData: ClientData;
  let clientDataBytes: Uint8Array;
  try {
    clientDataBytes = b64UrlToBytes(clientDataJsonB64);
    clientData = JSON.parse(bytesToUtf8(clientDataBytes)) as ClientData;
  } catch {
    return { ok: false, reason: "bad_client_data" };
  }

  if (clientData.type !== "webauthn.get") {
    return { ok: false, reason: "wrong_type" };
  }
  if (normB64Url(clientData.challenge) !== normB64Url(expectedChallengeB64)) {
    return { ok: false, reason: "challenge_mismatch" };
  }
  if (!allowedOrigins.includes(clientData.origin)) {
    return { ok: false, reason: "origin_mismatch" };
  }

  // Derive the expected rpId from the (now-validated) origin, exactly as the
  // client did from window.location at ceremony time. This keeps verification
  // correct behind a proxy that rewrites the Host header — we trust the signed,
  // allowlisted origin, never the request host.
  let expectedRpId: string;
  try {
    expectedRpId = getWebAuthnRpId(new URL(clientData.origin).hostname);
  } catch {
    return { ok: false, reason: "origin_mismatch" };
  }

  // 2. authenticatorData: rpIdHash (32) ‖ flags (1) ‖ counter (4) ‖ …
  let authData: Uint8Array;
  try {
    authData = b64UrlToBytes(authenticatorDataB64);
  } catch {
    return { ok: false, reason: "bad_client_data" };
  }
  if (authData.length < 37) return { ok: false, reason: "bad_client_data" };

  const expectedRpIdHash = await sha256Bytes(new TextEncoder().encode(expectedRpId));
  const rpIdHash = authData.subarray(0, 32);
  for (let i = 0; i < 32; i++) {
    if (rpIdHash[i] !== expectedRpIdHash[i]) {
      return { ok: false, reason: "rp_id_mismatch" };
    }
  }
  const flags = authData[32];
  if ((flags & 0x01) === 0) return { ok: false, reason: "user_not_present" };

  // 3. signed message = authenticatorData ‖ SHA-256(clientDataJSON)
  const clientDataHash = await sha256Bytes(clientDataBytes);
  const signed = new Uint8Array(authData.length + clientDataHash.length);
  signed.set(authData, 0);
  signed.set(clientDataHash, authData.length);

  // 4. DER → raw r‖s
  let rawSig: Uint8Array;
  try {
    rawSig = derToRaw(b64UrlToBytes(signatureB64));
  } catch {
    return { ok: false, reason: "bad_signature_encoding" };
  }

  // 5. verify
  let key: CryptoKey;
  try {
    key = await importVerifyKey(publicKeyJwk);
  } catch {
    return { ok: false, reason: "bad_signature_encoding" };
  }
  const ok = await crypto.subtle.verify(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    rawSig as unknown as BufferSource,
    signed as unknown as BufferSource,
  );
  return ok ? { ok: true } : { ok: false, reason: "signature_invalid" };
}
