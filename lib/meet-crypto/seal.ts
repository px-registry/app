// 記憶装置 層3-seal — 控えの秘密鍵を owner のパスフレーズで封緘（0013 invariant 6）。
//
// このレーン（lib/meet-crypto）は WebCrypto だけ: fetch なし・storage なし（保存は
// meet-memory、配送は meet-net）。依存追加なし — PBKDF2 → AES-256-GCM。
//
// 用途: 控え bundle（px.meet-memory/v2 の sealedKey?）に秘密鍵を載せる日だけ、
// 平文 JWK を出さず封緘形で載せる。passphrase 未設定なら sealedKey は不在＝秘密鍵は
// 控えに一切出ない（現状の安全既定の保存）。
//
// fail-closed（envelope.ts と意図して別の作法）: 誤 passphrase は **auth error を
// throw** する（部分復号ゼロ）。封筒は静かに null だが、封緘は owner 自身の鍵の戻し
// 入れ — 「passphrase が違う」を呼び手が掴めるよう例外にする。
//
// passphrase と recovery code は暗号層で分離 — recovery code を封緘 passphrase に
// 流用しない（別物・別経路）。

export type SealedKeyV1 = {
  kdf: "PBKDF2";
  salt: string; // base64
  iter: number;
  hash: "SHA-256";
  iv: string; // base64
  alg: "AES-GCM";
  ciphertext: string; // base64 — wrapped priv JWK（中身は opaque; "d" は現れない）
};

const PBKDF2_ITER = 310_000; // OWASP 2023 floor (PBKDF2-HMAC-SHA256)
const AES_PARAMS = { name: "AES-GCM", length: 256 } as const;

function toB64(buf: ArrayBuffer): string {
  let bin = "";
  for (const b of new Uint8Array(buf)) bin += String.fromCharCode(b);
  return btoa(bin);
}
function fromB64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function deriveWrapKey(passphrase: string, salt: Uint8Array, iter: number): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    { name: "PBKDF2" },
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: iter, hash: "SHA-256" },
    base,
    AES_PARAMS,
    false,
    ["encrypt", "decrypt"],
  );
}

/** Wrap a private JWK under the owner passphrase. Fresh salt + iv every call. */
export async function sealPrivateKey(priv: JsonWebKey, passphrase: string): Promise<SealedKeyV1> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveWrapKey(passphrase, salt, PBKDF2_ITER);
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(JSON.stringify(priv)),
  );
  return {
    kdf: "PBKDF2",
    salt: toB64(salt.buffer),
    iter: PBKDF2_ITER,
    hash: "SHA-256",
    iv: toB64(iv.buffer),
    alg: "AES-GCM",
    ciphertext: toB64(ct),
  };
}

/**
 * Unwrap with the owner passphrase. THROWS on a wrong passphrase (GCM auth
 * failure) — fail-closed, no partial decrypt. The caller turns that into a
 * 生活の言葉のエラー（「パスフレーズが違うようです」）.
 */
export async function openSealedKey(sealed: SealedKeyV1, passphrase: string): Promise<JsonWebKey> {
  const key = await deriveWrapKey(passphrase, fromB64(sealed.salt), sealed.iter);
  let plain: ArrayBuffer;
  try {
    plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromB64(sealed.iv) as BufferSource },
      key,
      fromB64(sealed.ciphertext) as BufferSource,
    );
  } catch {
    // Wrong passphrase / tampered ciphertext — auth error, never a partial result.
    throw new Error("sealed key: authentication failed (wrong passphrase or tampered)");
  }
  return JSON.parse(new TextDecoder().decode(plain)) as JsonWebKey;
}
