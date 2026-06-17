// PX Device Mesh — 鍵と署名（端末で生まれ、公開鍵だけが外に出る）。
// 設計: docs/r2/device-mesh-how-v0.3.md §3（三鍵）・§13 G1/G2。
//
// このレーン（lib/meet-crypto）は WebCrypto だけ: fetch なし・localStorage なし・indexedDB なし
// （private の保存は meet-memory/mesh、配送は meet-net/mesh-api）。
//
// 三鍵のうちこのファイルは:
//   - device key（端末ごと・2鍵）: device_sig(ECDSA P-256・relay 要求署名/device-add 認可)
//                                   ＋ device_enc(ECDH P-256・handoff/epoch 鍵配布の wrap 宛先)
//   - owner content epoch keypair の鍵生成は既存 mintEncKeyPair()（ECDH P-256）を流用（keys.ts）。
//   private JWK（device_sig.priv / device_enc.priv / epoch.priv）はこの端末の IndexedDB にだけ住む。

import { mintEncKeyPair, isPublicEncJwk, parseEncPub, type EncKeyPairV1 } from "./keys.ts";

export type SigKeyPairV1 = { pub: JsonWebKey; priv: JsonWebKey };
export type DeviceKeysV1 = { sig: SigKeyPairV1; enc: EncKeyPairV1 };

const ECDSA_GEN: EcKeyGenParams = { name: "ECDSA", namedCurve: "P-256" };
const ECDSA_SIGN: EcdsaParams = { name: "ECDSA", hash: "SHA-256" };

function bytesToB64(b: Uint8Array): string {
  let s = "";
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s);
}

function hex(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += b.toString(16).padStart(2, "0");
  return s;
}

/** device 鍵（sig=ECDSA 署名鍵・enc=ECDH wrap 宛先鍵）を生成。private は端末のみ。 */
export async function mintDeviceKeys(): Promise<DeviceKeysV1> {
  const kp = await crypto.subtle.generateKey(ECDSA_GEN, true, ["sign", "verify"]);
  const sig: SigKeyPairV1 = {
    pub: await crypto.subtle.exportKey("jwk", kp.publicKey),
    priv: await crypto.subtle.exportKey("jwk", kp.privateKey),
  };
  const enc = await mintEncKeyPair();
  return { sig, enc };
}

/** owner の安定公開 routing 同一性（不透明 32 hex・epoch 横断で不変）。 */
export function mintOwnerRef(): string {
  return hex(crypto.getRandomValues(new Uint8Array(16)));
}

/** device_id（dev_ 接頭辞・端末 mint）。 */
export function mintDeviceId(): string {
  return `dev_${hex(crypto.getRandomValues(new Uint8Array(8)))}`;
}

/** payload_id（mesh_ 接頭辞・端末 mint）。relay 用（Phase C）だがここに置く。 */
export function mintPayloadId(): string {
  return `mesh_${hex(crypto.getRandomValues(new Uint8Array(8)))}`;
}

/** 署名対象の正準バイト列（再直列化のずれを避けるため文字列を直接署名する）。 */
export function meshSignBytes(dataStr: string, ts: number) {
  return new TextEncoder().encode(`${dataStr}\n${ts}`);
}

/** device_sig.priv（ECDSA JWK）で dataStr+ts を署名 → base64。要求認証に使う。 */
export async function signMesh(privJwk: JsonWebKey, dataStr: string, ts: number): Promise<string> {
  const key = await crypto.subtle.importKey("jwk", privJwk, ECDSA_GEN, false, ["sign"]);
  const sig = await crypto.subtle.sign(ECDSA_SIGN, key, meshSignBytes(dataStr, ts));
  return bytesToB64(new Uint8Array(sig));
}

/** ECDSA 公開 JWK の形ガード（'d' 拒否は isPublicEncJwk と同形＝P-256 EC public）。 */
export function isPublicSigJwk(v: unknown): v is JsonWebKey {
  return isPublicEncJwk(v);
}

/** 公開鍵 JWK の指紋（SHA-256 hex・QR の sig fingerprint = Phase B）。 */
export async function jwkFingerprint(pub: JsonWebKey): Promise<string> {
  const canon = JSON.stringify({ kty: pub.kty, crv: pub.crv, x: pub.x, y: pub.y });
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canon));
  return hex(new Uint8Array(digest));
}

// ── サーバと共有する純粋ロジック（形ガード・署名検証・上限）───────────────────────
// ref.ts / keys.ts と同じく client と Functions の両方が読む（D1 に触れない＝lib に置ける）。
// functions/_mesh.ts はここを re-export し、D1 を要すヘルパーだけを上に足す。

export const MAX_MESH_PUB = 240; // JWK 公開鍵の上限（enc/sig 共通）
export const MAX_LABEL = 40;
export const MESH_TS_SKEW_MS = 5 * 60 * 1000; // 署名 ts の許容ずれ（±5分）

export function isOwnerRef(s: unknown): s is string {
  return typeof s === "string" && /^[0-9a-f]{32}$/.test(s);
}
export function isDeviceId(s: unknown): s is string {
  return typeof s === "string" && /^dev_[0-9a-f]{16}$/.test(s);
}
export function isMeshPayloadId(s: unknown): s is string {
  return typeof s === "string" && /^mesh_[0-9a-f]{16,32}$/.test(s);
}
export function isB64(s: unknown): s is string {
  return typeof s === "string" && s.length > 0 && s.length <= 4096 && /^[A-Za-z0-9+/=]+$/.test(s);
}

/** 公開鍵 JWK 文字列の検証（enc/sig 共通・'d' 付きは拒否・上限つき）。 */
export function validPubStr(s: unknown): s is string {
  return typeof s === "string" && s.length > 0 && s.length <= MAX_MESH_PUB && parseEncPub(s) !== null;
}

function b64ToBytes(s: string) {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

const ECDSA_IMPORT: EcKeyImportParams = { name: "ECDSA", namedCurve: "P-256" };
const ECDSA_VERIFY: EcdsaParams = { name: "ECDSA", hash: "SHA-256" };

/** device_sig 署名の検証（ECDSA P-256 / SHA-256）。Functions と client が同一実装を読む。 */
export async function verifyMeshSig(
  sigPubJwk: JsonWebKey,
  sigB64: string,
  dataStr: string,
  ts: number,
): Promise<boolean> {
  try {
    const key = await crypto.subtle.importKey("jwk", sigPubJwk, ECDSA_IMPORT, false, ["verify"]);
    return await crypto.subtle.verify(ECDSA_VERIFY, key, b64ToBytes(sigB64), meshSignBytes(dataStr, ts));
  } catch {
    return false;
  }
}
