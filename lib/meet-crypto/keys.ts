// R2 0013 — E2EE 鍵（端末で生まれ、公開鍵だけが外に出る）。
//
// このレーン（lib/meet-crypto）は WebCrypto だけを使う: fetch なし・localStorage
// なし・indexedDB なし（保存は meet-memory の enckey store、配送は meet-net）。
// 秘密鍵 JWK はこの端末の IndexedDB にだけ住む — サーバ・ログ・チャットの
// どこにも出さない（0013 §1 の表が正本）。
//
// v1 は ECDH P-256（WebCrypto の普及面・0013 §2）。gen（世代）はサーバ側が
// 変更検知で繰り上げ、受け手には「鍵が変わりました」の事実表示だけが届く。

export type EncKeyPairV1 = {
  /** JWK (EC P-256, public) — the ONLY part that ever leaves the device. */
  pub: JsonWebKey;
  /** JWK (EC P-256, private) — device-held; export only under owner passphrase (0013 inv.6). */
  priv: JsonWebKey;
};

const ECDH_PARAMS: EcKeyGenParams = { name: "ECDH", namedCurve: "P-256" };

export async function mintEncKeyPair(): Promise<EncKeyPairV1> {
  const kp = await crypto.subtle.generateKey(ECDH_PARAMS, true, ["deriveKey", "deriveBits"]);
  const pub = await crypto.subtle.exportKey("jwk", kp.publicKey);
  const priv = await crypto.subtle.exportKey("jwk", kp.privateKey);
  return { pub, priv };
}

/**
 * Shape guard for a PUBLIC EC P-256 JWK — fail-closed on private material:
 * a JWK carrying "d" (the private scalar) is REFUSED outright, so a bug that
 * grabs the wrong half can never publish a secret. Shared by client and server.
 */
export function isPublicEncJwk(v: unknown): v is JsonWebKey {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return false;
  const j = v as Record<string, unknown>;
  if ("d" in j) return false; // private scalar — never crosses the line
  return (
    j.kty === "EC" &&
    j.crv === "P-256" &&
    typeof j.x === "string" && j.x.length > 0 && j.x.length <= 88 &&
    typeof j.y === "string" && j.y.length > 0 && j.y.length <= 88
  );
}

/** Serialized form for transport/storage caps (server re-checks shape). */
export function encPubToString(pub: JsonWebKey): string {
  return JSON.stringify({ kty: pub.kty, crv: pub.crv, x: pub.x, y: pub.y });
}

export function parseEncPub(s: string): JsonWebKey | null {
  try {
    const v: unknown = JSON.parse(s);
    return isPublicEncJwk(v) ? v : null;
  } catch {
    return null;
  }
}
