// POST /api/mesh/register — Device Mesh bootstrap（初端末・owner_ref / 初 epoch / 初 device）。
//
// 設計: docs/r2/device-mesh-how-v0.3.md §3.2/§3.4 経路1。A.1 裁定（2026-06-17）:
//   **identity root = passkey session**。owner_ref は **passkey-authenticated handle** に紐づく。
//   passkey session が無ければ register は 401（production path で passkey なしの owner 作成は不成立）。
//   ownerToken は identity root にしない — 端末ローカル補助 ID で、一方向ハッシュ（deriveParticipantRef）
//   で participant_ref（公開面の写像補助）にだけ使う。raw 保存・log 出力はしない。
//
// サーバが受けるのは **公開鍵だけ**（device sig_pub/enc_pub・epoch_pub）。private は一切来ない（'d' 拒否）。

import {
  json,
  isAllowedWriteOrigin,
  isDeviceId,
  validPubStr,
  sessionHandle,
  mintOwnerRef,
  meshEffectiveMode,
  meshWriteAllowed,
  parseAllowlist,
  MAX_LABEL,
  type MeshEnv,
} from "../../_mesh.ts";
import { deriveParticipantRef, isOwnerToken } from "../../_meet.ts";

export const onRequestPost: PagesFunction<MeshEnv> = async ({ request, env }) => {
  if (!isAllowedWriteOrigin(request)) return json({ ok: false, error: "bad_origin" }, 403);

  // identity root: passkey session（無ければ 401・ownerToken では bootstrap しない）。
  const handle = await sessionHandle(env, request);
  if (handle === null) return json({ ok: false, error: "passkey_required" }, 401);

  const raw = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (raw === null || typeof raw !== "object") return json({ ok: false, error: "body" }, 400);
  if (!validPubStr(raw.epochPub)) return json({ ok: false, error: "epoch_pub" }, 400);

  const dev = raw.device;
  if (typeof dev !== "object" || dev === null) return json({ ok: false, error: "device" }, 400);
  const d = dev as Record<string, unknown>;
  if (!isDeviceId(d.deviceId)) return json({ ok: false, error: "device_id" }, 400);
  if (!validPubStr(d.sigPub)) return json({ ok: false, error: "sig_pub" }, 400);
  if (!validPubStr(d.encPub)) return json({ ok: false, error: "enc_pub" }, 400);
  const label = typeof d.label === "string" ? d.label.trim().slice(0, MAX_LABEL) : "";

  // ownerToken は任意・補助のみ: 一方向ハッシュで participant_ref（公開面写像）にだけ使う。
  const participantRef = isOwnerToken(raw.ownerToken) ? await deriveParticipantRef(raw.ownerToken) : "";

  // MESH_WRITE gate（server authoritative）。register は **新規 owner の bootstrap が write** —
  // ただし owner_ref はここで mint される（chicken-egg）ので、新規は **mode>off** で通し、
  // 載るべき allowlist 判定は content write（relay/handoff put）で owner_ref を見て効かせる。
  // mode=off は「mesh を一切有効化しない」deliberate 状態 → 新規 bootstrap も止める（fail-closed）。
  // 既存 owner の register は読み（INSERT 無し）→ mode に関わらず ref を返し、capability を同梱して
  // client の正直表示（B）に使わせる。
  const mode = await meshEffectiveMode(env);
  const allowlist = parseAllowlist(env.MESH_OWNER_ALLOWLIST);

  try {
    // owner_ref は handle に束ねる（passkey 同一性が根）。既にあれば既存を返す（冪等）。
    // 2 台目以降は register でなく handoff/device-add（Phase B）を通る。
    const existing = await env.BOARD
      .prepare("SELECT owner_ref FROM r15_owner WHERE handle = ?1 LIMIT 1")
      .bind(handle)
      .all<{ owner_ref: string }>();
    const existingRef = (existing.results ?? [])[0]?.owner_ref;
    if (existingRef !== undefined) {
      return json({
        ok: true,
        ownerRef: existingRef,
        existing: true,
        mode,
        writeAllowed: meshWriteAllowed(mode, existingRef, allowlist),
      });
    }

    if (mode === "off") return json({ ok: false, error: "mesh_disabled", mode, writeAllowed: false }, 403);

    const ownerRef = mintOwnerRef();
    const now = new Date().toISOString();
    await env.BOARD.batch([
      env.BOARD
        .prepare(
          "INSERT INTO r15_owner (owner_ref, handle, participant_ref, current_epoch, created_at, updated_at) " +
            "VALUES (?1, ?2, ?3, 1, ?4, ?4)",
        )
        .bind(ownerRef, handle, participantRef, now),
      env.BOARD
        .prepare(
          "INSERT INTO r15_owner_epoch (owner_ref, epoch, epoch_pub, active, created_at) VALUES (?1, 1, ?2, 1, ?3)",
        )
        .bind(ownerRef, raw.epochPub, now),
      env.BOARD
        .prepare(
          "INSERT INTO r15_device (device_id, owner_ref, sig_pub, enc_pub, label, added_at, added_by, revoked_at, last_epoch) " +
            "VALUES (?1, ?2, ?3, ?4, ?5, ?6, '', '', 1)",
        )
        .bind(d.deviceId, ownerRef, d.sigPub, d.encPub, label, now),
    ]);
    return json(
      { ok: true, ownerRef, epoch: 1, existing: false, mode, writeAllowed: meshWriteAllowed(mode, ownerRef, allowlist) },
      201,
    );
  } catch {
    return json({ ok: false, error: "register_failed" }, 500);
  }
};

export const onRequestOptions: PagesFunction<MeshEnv> = async () =>
  new Response(null, { status: 204, headers: { Allow: "POST, OPTIONS" } });
