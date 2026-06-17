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

// ── Phase B: QR 束縛 handoff（verdict G1）─────────────────────────────────────────
// QR は新端末が作り、自分の sig priv で {did,sid,nonce,encPub,exp} を署名する。
// 既存端末は **QR 内の encPub** へ bundle を封緘する（server 後取得鍵を信頼起点にしない）。
// QR 署名で「この QR は encPub/sigPub の保有者が作った」を縛る（差し替え検知）。

export type HandoffQRV1 = {
  v: 1;
  did: string; // 新端末 device_id（dev_…）
  sid: string; // session id（16 hex）
  nonce: string; // pairing nonce（32 hex）
  encPub: string; // 新端末 enc 公開 JWK（封緘宛先）
  sigPub: string; // 新端末 sig 公開 JWK（QR 署名の検証鍵）
  exp: number; // 失効時刻（epoch ms）
  name?: string;
  sig: string; // ECDSA over handoffQRSignBytes（sigPub で検証）
};

/** QR 署名の対象（最低 sessionId/nonce/encPub/expiry＋did を縛る）。 */
export function handoffQRSignBytes(did: string, sid: string, nonce: string, encPub: string, exp: number) {
  return new TextEncoder().encode(`pxmesh-handoff-qr:${did}\n${sid}\n${nonce}\n${encPub}\n${exp}`);
}

async function signHandoffQR(sigPriv: JsonWebKey, did: string, sid: string, nonce: string, encPub: string, exp: number): Promise<string> {
  const key = await crypto.subtle.importKey("jwk", sigPriv, ECDSA_GEN, false, ["sign"]);
  const sig = await crypto.subtle.sign(ECDSA_SIGN, key, handoffQRSignBytes(did, sid, nonce, encPub, exp));
  return bytesToB64(new Uint8Array(sig));
}

async function verifyHandoffQRSig(sigPubJwk: JsonWebKey, sigB64: string, did: string, sid: string, nonce: string, encPub: string, exp: number): Promise<boolean> {
  try {
    const key = await crypto.subtle.importKey("jwk", sigPubJwk, ECDSA_IMPORT, false, ["verify"]);
    return await crypto.subtle.verify(ECDSA_VERIFY, key, b64ToBytes(sigB64), handoffQRSignBytes(did, sid, nonce, encPub, exp));
  } catch {
    return false;
  }
}

/** 新端末側: 自分の鍵で署名した QR を作る（exp は呼び出し側が now+TTL で渡す）。 */
export async function buildHandoffQR(
  did: string,
  encPub: string,
  sigPub: string,
  sigPriv: JsonWebKey,
  exp: number,
  name?: string,
): Promise<HandoffQRV1> {
  const sid = hex(crypto.getRandomValues(new Uint8Array(8)));
  const nonce = hex(crypto.getRandomValues(new Uint8Array(16)));
  const sig = await signHandoffQR(sigPriv, did, sid, nonce, encPub, exp);
  const base: HandoffQRV1 = { v: 1, did, sid, nonce, encPub, sigPub, exp, sig };
  return name ? { ...base, name: name.slice(0, MAX_LABEL) } : base;
}

/**
 * 既存端末側: QR を検証して受理する。形・期限・**QR 署名（sigPub で検証）**をすべて通って初めて返す。
 * server から後取得した鍵は一切使わない — 信頼起点は QR の中身だけ。失効・改竄は null。
 */
export async function parseHandoffQR(s: string, now: number): Promise<HandoffQRV1 | null> {
  let v: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(s);
    if (typeof parsed !== "object" || parsed === null) return null;
    v = parsed as Record<string, unknown>;
  } catch {
    return null;
  }
  if (v.v !== 1) return null;
  if (!isDeviceId(v.did)) return null;
  if (typeof v.sid !== "string" || !/^[0-9a-f]{16}$/.test(v.sid)) return null;
  if (typeof v.nonce !== "string" || !/^[0-9a-f]{32}$/.test(v.nonce)) return null;
  if (!validPubStr(v.encPub) || !validPubStr(v.sigPub)) return null;
  if (typeof v.exp !== "number" || !Number.isFinite(v.exp) || v.exp <= now) return null; // 失効
  if (!isB64(v.sig)) return null;
  const sigPubJwk = parseEncPub(v.sigPub);
  if (sigPubJwk === null) return null;
  const okSig = await verifyHandoffQRSig(sigPubJwk, v.sig, v.did, v.sid, v.nonce, v.encPub, v.exp);
  if (!okSig) return null; // 署名改竄
  const name = typeof v.name === "string" ? v.name.slice(0, MAX_LABEL) : undefined;
  const out: HandoffQRV1 = { v: 1, did: v.did, sid: v.sid, nonce: v.nonce, encPub: v.encPub, sigPub: v.sigPub, exp: v.exp, sig: v.sig };
  return name ? { ...out, name } : out;
}
