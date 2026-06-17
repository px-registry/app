// PX Device Mesh — Functions の共有ヘルパー（Leading underscore = not routed）。
// 設計: docs/r2/device-mesh-how-v0.3.md §2/§3/§4/§13。
//
// 憲法（ここで強制）:
//   * サーバは **公開鍵だけ**を持つ（device の sig_pub/enc_pub・epoch_pub）。private JWK（'d'）は
//     publish ごと拒否（isPublicEncJwk）。**平文本文・private key を一切持たない**。
//   * relay body は暗号文のみ。ack は purge 判定の内部資料 — counterparty にも presence にも出さない。
//   * 要求認証は device_sig 署名（ECDSA P-256）。revoked 端末は 401（fail-closed）。
//
// Imports は top-level lib/ への相対（Pages の esbuild は @ alias を持たない — _meet.ts と同じ）。

import { json, type MeetEnv, isAllowedWriteOrigin, MAX_CIPHERTEXT_B64 } from "./_meet.ts";
import { readSession, type AuthEnv } from "./_auth.ts";
import { isPublicEncJwk, parseEncPub } from "../lib/meet-crypto/keys.ts";
import {
  isOwnerRef,
  isDeviceId,
  isMeshPayloadId,
  isB64,
  validPubStr,
  verifyMeshSig,
  mintOwnerRef,
  mintPayloadId,
  MAX_MESH_PUB,
  MAX_LABEL,
  MESH_TS_SKEW_MS,
} from "../lib/meet-crypto/mesh.ts";
import { effectiveMeshMode, parseAllowlist, meshWriteAllowed, type MeshMode } from "../lib/meet-mesh/mode.ts";

export type { MeshMode };
/** mesh write の KV lever のキー（AUTH KV 内・allowlist は KV に置かない＝env のみ）。 */
export const MESH_MODE_KV_KEY = "mesh:mode";

/** Phase B handoff: 72h hard TTL / chunk 上限（≒768KB bundle）。 */
export const HANDOFF_TTL_HOURS = 72;
export const MAX_HANDOFF_CHUNKS = 64;
/** Phase C relay delta: 14日 TTL（既存 envelope と同値）。 */
export const MESH_TTL_DAYS = 14;
export const MESH_LANES = new Set(["self", "peer"]);
export const MESH_DELTA_PTYPES = new Set(["memory-delta", "talk-mirror", "talk-msg"]);

// 純粋ロジック（形ガード・署名検証・上限）は lib/meet-crypto/mesh.ts に住み、ここで re-export。
// このファイルには D1/identity を要すヘルパー（verifySignedRequest / activeEpoch / rotateEpoch /
// sessionHandle …）だけを足す。
export { json, isAllowedWriteOrigin, isPublicEncJwk, parseEncPub };
export { isOwnerRef, isDeviceId, isMeshPayloadId, isB64, validPubStr, verifyMeshSig, mintOwnerRef, mintPayloadId };
export { MAX_MESH_PUB, MAX_LABEL, MESH_TS_SKEW_MS, MAX_CIPHERTEXT_B64 };

// MeshEnv は BOARD（D1）＋ AUTH/AUTH_SECRET（passkey session 検証）を持つ。
// bootstrap の identity root は **passkey session**（ownerToken ではない・A.1 裁定 2026-06-17）。
// mesh write の lever: env(MESH_MODE_CAP=deliberate cap・MESH_OWNER_ALLOWLIST=env のみ)＋
// KV(MESH_MODE=速い lever・AUTH KV 内 mesh:mode)。どれも optional＝欠落は fail-closed(off)。
export type MeshEnv = MeetEnv &
  AuthEnv & {
    MESH_MODE_CAP?: string;
    MESH_OWNER_ALLOWLIST?: string;
  };

// 純粋ロジック（min/allowlist 判定）を re-export — endpoint 側で owner_ref 解決後に writeAllowed を
// 計算するため（register は owner_ref を mint する＝gate を mode と allowlist の二段で読む）。
export { effectiveMeshMode, parseAllowlist, meshWriteAllowed };

/**
 * effective mode（min(KV:mesh:mode, MESH_MODE_CAP)）だけを読む。
 * KV 読み取り失敗・env/KV 欠落/不正は off（fail-closed）。owner_ref を要さない場面（register の mint 前）用。
 */
export async function meshEffectiveMode(env: MeshEnv): Promise<MeshMode> {
  let kvMode: string | null = null;
  try {
    kvMode = await env.AUTH.get(MESH_MODE_KV_KEY);
  } catch {
    kvMode = null; // KV 読み取り失敗 → off
  }
  return effectiveMeshMode(env.MESH_MODE_CAP, kvMode);
}

/**
 * mesh write の許否を **サーバが**決める（server authoritative）。
 * allowed は owner_ref（passkey session 由来・呼び出し側が解決）が allowlist/on を満たすか。
 * **この gate は write だけを止める** — dual-read/legacy/ack/purge/revoke/expired cleanup/safety は別経路で生きる。
 */
export async function meshWriteGate(env: MeshEnv, ownerRef: string | null): Promise<{ allowed: boolean; mode: MeshMode }> {
  const mode = await meshEffectiveMode(env);
  const allowed = meshWriteAllowed(mode, ownerRef, parseAllowlist(env.MESH_OWNER_ALLOWLIST));
  return { allowed, mode };
}

/**
 * passkey session（__px_session・HMAC 署名 cookie）から handle を解決する。
 * Device Mesh の owner identity の根。session が無ければ null（register は 401）。
 * ※ownerToken は identity root にしない — 端末ローカル補助 ID（→ participant_ref の一方向写像）だけ。
 */
export async function sessionHandle(env: MeshEnv, request: Request): Promise<string | null> {
  const s = await readSession(env, request);
  return s !== null && typeof s.handle === "string" && s.handle.length > 0 ? s.handle : null;
}

export type DeviceRow = {
  device_id: string;
  owner_ref: string;
  sig_pub: string;
  enc_pub: string;
  revoked_at: string;
};

/**
 * device_sig 署名のついた要求を検証する。エンベロープ = { dataStr, ts, deviceId, sig }。
 * 成功なら device 行（active のみ）＋ JSON.parse(dataStr) を返す。
 * revoked 端末は弾く（relay fetch 停止＝fail-closed・§4.1）。
 */
export async function verifySignedRequest(
  env: MeshEnv,
  raw: unknown,
): Promise<
  | { ok: true; device: DeviceRow; data: Record<string, unknown> }
  | { ok: false; status: number; error: string }
> {
  if (typeof raw !== "object" || raw === null) return { ok: false, status: 400, error: "body" };
  const r = raw as Record<string, unknown>;
  if (typeof r.dataStr !== "string" || r.dataStr.length > 8192) {
    return { ok: false, status: 400, error: "data" };
  }
  if (typeof r.ts !== "number" || !Number.isFinite(r.ts)) return { ok: false, status: 400, error: "ts" };
  if (!isDeviceId(r.deviceId)) return { ok: false, status: 400, error: "device_id" };
  if (!isB64(r.sig)) return { ok: false, status: 400, error: "sig" };
  if (Math.abs(Date.now() - r.ts) > MESH_TS_SKEW_MS) return { ok: false, status: 401, error: "stale_ts" };

  let device: DeviceRow | undefined;
  try {
    const found = await env.BOARD
      .prepare("SELECT device_id, owner_ref, sig_pub, enc_pub, revoked_at FROM r15_device WHERE device_id = ?1")
      .bind(r.deviceId)
      .all<DeviceRow>();
    device = (found.results ?? [])[0];
  } catch {
    return { ok: false, status: 500, error: "lookup_failed" };
  }
  if (device === undefined) return { ok: false, status: 401, error: "no_device" };
  if (device.revoked_at !== "") return { ok: false, status: 401, error: "revoked" };

  const sigPub = parseEncPub(device.sig_pub);
  if (sigPub === null) return { ok: false, status: 401, error: "device_key" };
  const valid = await verifyMeshSig(sigPub, r.sig, r.dataStr, r.ts);
  if (!valid) return { ok: false, status: 401, error: "bad_sig" };

  let data: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(r.dataStr);
    if (typeof parsed !== "object" || parsed === null) return { ok: false, status: 400, error: "data_shape" };
    data = parsed as Record<string, unknown>;
  } catch {
    return { ok: false, status: 400, error: "data_json" };
  }
  return { ok: true, device, data };
}

/** owner の現在 active な epoch（暗号化宛先・stale put 拒否の基準・§4.2 G2）。 */
export async function activeEpoch(
  env: MeshEnv,
  ownerRef: string,
): Promise<{ epoch: number; epochPub: string } | null> {
  try {
    const found = await env.BOARD
      .prepare("SELECT epoch, epoch_pub FROM r15_owner_epoch WHERE owner_ref = ?1 AND active = 1 ORDER BY epoch DESC LIMIT 1")
      .bind(ownerRef)
      .all<{ epoch: number; epoch_pub: string }>();
    const row = (found.results ?? [])[0];
    return row === undefined ? null : { epoch: row.epoch, epochPub: row.epoch_pub };
  } catch {
    return null;
  }
}

/** owner の active device 数（purge の「全ACK」基準・§4.5）。 */
export async function activeDeviceCount(env: MeshEnv, ownerRef: string): Promise<number> {
  const found = await env.BOARD
    .prepare("SELECT COUNT(*) AS n FROM r15_device WHERE owner_ref = ?1 AND revoked_at = ''")
    .bind(ownerRef)
    .all<{ n: number }>();
  return (found.results ?? [])[0]?.n ?? 0;
}

/**
 * 全 active device ACK で payload を物理削除する（verdict G5）。最初の1台 ACK では消さない。
 * inactive(revoked) device は分母にも ack 集合にも入らない（join で revoked_at='' に限定）＝
 * 残りの active が全員 ack すれば purge が完走する。owner 配下の epoch-wrap payload に限定。
 * 直前に ack された id 群（任意）に絞って評価する（無指定なら owner の held 全件）。
 */
export async function purgeFullyAcked(env: MeshEnv, ownerRef: string, payloadIds?: string[]): Promise<void> {
  const filter =
    payloadIds && payloadIds.length > 0
      ? ` AND p.payload_id IN (${payloadIds.map((_, i) => `?${i + 2}`).join(", ")})`
      : "";
  const sql =
    "DELETE FROM r15_mesh_payload WHERE payload_id IN (" +
    "  SELECT p.payload_id FROM r15_mesh_payload p" +
    "  WHERE p.audience_ref = ?1 AND p.wrap_to = 'epoch'" +
    filter +
    "    AND (SELECT COUNT(*) FROM r15_device d WHERE d.owner_ref = ?1 AND d.revoked_at = '')" +
    "      = (SELECT COUNT(*) FROM r15_mesh_ack a JOIN r15_device d2 ON d2.device_id = a.device_id" +
    "         WHERE a.payload_id = p.payload_id AND d2.revoked_at = '')" +
    ")";
  const binds = payloadIds && payloadIds.length > 0 ? [ownerRef, ...payloadIds] : [ownerRef];
  await env.BOARD.prepare(sql).bind(...binds).run();
  // 親 payload を失った ack 行を掃除（孤児）。
  await env.BOARD.prepare("DELETE FROM r15_mesh_ack WHERE payload_id NOT IN (SELECT payload_id FROM r15_mesh_payload)").run();
}

/**
 * epoch を巻き直す（verdict G2）: 旧 active を inactive 化 → 新 epoch(max+1) を active 挿入 →
 * r15_owner.current_epoch を繰り上げ。原子的（旧 active が新規 wrap 宛先に残る窓を作らない）。
 * 新 epoch private の **active 端末への配布**は relay（ptype=epoch-key・Phase C）— ここは registry だけ。
 */
export async function rotateEpoch(env: MeshEnv, ownerRef: string, newEpochPub: string): Promise<number> {
  const maxRow = await env.BOARD
    .prepare("SELECT MAX(epoch) AS m FROM r15_owner_epoch WHERE owner_ref = ?1")
    .bind(ownerRef)
    .all<{ m: number | null }>();
  const next = ((maxRow.results ?? [])[0]?.m ?? 0) + 1;
  const now = new Date().toISOString();
  await env.BOARD.batch([
    env.BOARD.prepare("UPDATE r15_owner_epoch SET active = 0 WHERE owner_ref = ?1 AND active = 1").bind(ownerRef),
    env.BOARD
      .prepare("INSERT INTO r15_owner_epoch (owner_ref, epoch, epoch_pub, active, created_at) VALUES (?1, ?2, ?3, 1, ?4)")
      .bind(ownerRef, next, newEpochPub, now),
    env.BOARD.prepare("UPDATE r15_owner SET current_epoch = ?2, updated_at = ?3 WHERE owner_ref = ?1").bind(ownerRef, next, now),
  ]);
  return next;
}
