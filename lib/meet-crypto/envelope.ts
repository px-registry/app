// R2 0013 — 封筒の施錠と開封（端末でだけ走る・サーバは ciphertext を運ぶだけ）。
//
// 方式: 封筒ごとの ephemeral ECDH(P-256) × 受け手の公開鍵 → AES-256-GCM。
// 送り手は自分宛ての複製を作らない — 自分の端末に平文原本が残る（owner-held 転写）。
// 開封失敗は null（fail-closed: 壊れた封筒・改竄・鍵違いは静かに null → UI が
// 正直な一行を出す。例外を UI に投げない）。

import { encPubToString, parseEncPub } from "./keys.ts";

export type SealedEnvelopeV1 = {
  ephPub: string;     // JWK 直列形（公開成分のみ）
  iv: string;         // base64
  ciphertext: string; // base64
};

const ECDH_PARAMS: EcKeyGenParams = { name: "ECDH", namedCurve: "P-256" };
const AES_PARAMS = { name: "AES-GCM", length: 256 } as const;

function toB64(buf: ArrayBuffer): string {
  let bin = "";
  for (const b of new Uint8Array(buf)) bin += String.fromCharCode(b);
  return btoa(bin);
}
function fromB64(s: string): Uint8Array | null {
  try {
    const bin = atob(s);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

async function deriveAes(privateKey: CryptoKey, publicJwk: JsonWebKey): Promise<CryptoKey> {
  const pub = await crypto.subtle.importKey("jwk", publicJwk, ECDH_PARAMS, false, []);
  return crypto.subtle.deriveKey(
    { name: "ECDH", public: pub },
    privateKey,
    AES_PARAMS,
    false,
    ["encrypt", "decrypt"],
  );
}

/** Seal plaintext to ONE recipient. A fresh ephemeral pair per envelope. */
export async function sealEnvelope(
  recipientPub: JsonWebKey,
  plaintext: string,
): Promise<SealedEnvelopeV1> {
  const eph = await crypto.subtle.generateKey(ECDH_PARAMS, true, ["deriveKey"]);
  const aes = await deriveAes(eph.privateKey, recipientPub);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    aes,
    new TextEncoder().encode(plaintext),
  );
  const ephPubJwk = await crypto.subtle.exportKey("jwk", eph.publicKey);
  return { ephPub: encPubToString(ephPubJwk), iv: toB64(iv.buffer), ciphertext: toB64(ct) };
}

/** Open with MY private key. null on any failure — never throws into the UI. */
export async function openEnvelope(
  myPrivJwk: JsonWebKey,
  sealed: SealedEnvelopeV1,
): Promise<string | null> {
  try {
    const ephPub = parseEncPub(sealed.ephPub);
    const iv = fromB64(sealed.iv);
    const ct = fromB64(sealed.ciphertext);
    if (ephPub === null || iv === null || ct === null) return null;
    const priv = await crypto.subtle.importKey("jwk", myPrivJwk, ECDH_PARAMS, false, [
      "deriveKey",
    ]);
    const aes = await deriveAes(priv, ephPub);
    const pt = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv as BufferSource },
      aes,
      ct as BufferSource,
    );
    return new TextDecoder().decode(pt);
  } catch {
    return null; // 改竄・鍵違い・壊れ — fail-closed
  }
}
