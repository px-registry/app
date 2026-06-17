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

import { json, type MeetEnv, isAllowedWriteOrigin } from "./_meet.ts";
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
  MAX_MESH_PUB,
  MAX_LABEL,
  MESH_TS_SKEW_MS,
} from "../lib/meet-crypto/mesh.ts";

// 純粋ロジック（形ガード・署名検証・上限）は lib/meet-crypto/mesh.ts に住み、ここで re-export。
// このファイルには D1/identity を要すヘルパー（verifySignedRequest / activeEpoch / rotateEpoch /
// sessionHandle …）だけを足す。
export { json, isAllowedWriteOrigin, isPublicEncJwk, parseEncPub };
export { isOwnerRef, isDeviceId, isMeshPayloadId, isB64, validPubStr, verifyMeshSig, mintOwnerRef };
export { MAX_MESH_PUB, MAX_LABEL, MESH_TS_SKEW_MS };

// MeshEnv は BOARD（D1）＋ AUTH/AUTH_SECRET（passkey session 検証）を持つ。
// bootstrap の identity root は **passkey session**（ownerToken ではない・A.1 裁定 2026-06-17）。
export type MeshEnv = MeetEnv & AuthEnv;

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
