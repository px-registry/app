// POST /api/mesh/device — 既存信頼端末の署名で新端末を device list に追加（§3.4 経路2）。
//
// 設計: docs/r2/device-mesh-how-v0.3.md §3.4・§5.1b（G1: 登録 pub は QR の値と一致検証＝呼び出し側責務）。
// 認可 = 既存 active 端末の device_sig 署名（verifySignedRequest）。content private はサーバを通らない。
// data（署名対象）= { newDevice:{deviceId, sigPub, encPub, label} }。owner_ref は署名から解決。

import {
  json,
  isAllowedWriteOrigin,
  isDeviceId,
  validPubStr,
  verifySignedRequest,
  meshWriteGate,
  MAX_LABEL,
  type MeshEnv,
} from "../../_mesh.ts";

export const onRequestPost: PagesFunction<MeshEnv> = async ({ request, env }) => {
  if (!isAllowedWriteOrigin(request)) return json({ ok: false, error: "bad_origin" }, 403);

  const raw = (await request.json().catch(() => null)) as unknown;
  const auth = await verifySignedRequest(env, raw);
  if (!auth.ok) return json({ ok: false, error: auth.error }, auth.status);

  // MESH_WRITE gate（server authoritative）。device-add は handoff の前段 write —
  // ここを止めないと off/rollback 時に「bundle の付かない孤児 device 行」を作る。3 経路に加え
  // device-add も gate（strictly more fail-closed・新データ/意味の拡張なし＝GOAL 内）。deny=403。
  const gate = await meshWriteGate(env, auth.device.owner_ref);
  if (!gate.allowed) return json({ ok: false, error: "mesh_disabled", denied: true, mode: gate.mode }, 403);

  const nd = auth.data.newDevice;
  if (typeof nd !== "object" || nd === null) return json({ ok: false, error: "new_device" }, 400);
  const d = nd as Record<string, unknown>;
  if (!isDeviceId(d.deviceId)) return json({ ok: false, error: "device_id" }, 400);
  if (!validPubStr(d.sigPub)) return json({ ok: false, error: "sig_pub" }, 400);
  if (!validPubStr(d.encPub)) return json({ ok: false, error: "enc_pub" }, 400);
  const label = typeof d.label === "string" ? d.label.trim().slice(0, MAX_LABEL) : "";

  try {
    // device_id 衝突は冪等に扱う（同 owner 下に既にいれば existing）。
    const dup = await env.BOARD
      .prepare("SELECT owner_ref FROM r15_device WHERE device_id = ?1")
      .bind(d.deviceId)
      .all<{ owner_ref: string }>();
    const dupRow = (dup.results ?? [])[0];
    if (dupRow !== undefined) {
      if (dupRow.owner_ref === auth.device.owner_ref) {
        return json({ ok: true, deviceId: d.deviceId, existing: true });
      }
      return json({ ok: false, error: "device_taken" }, 409);
    }

    const epoch = await env.BOARD
      .prepare("SELECT current_epoch FROM r15_owner WHERE owner_ref = ?1")
      .bind(auth.device.owner_ref)
      .all<{ current_epoch: number }>();
    const curEpoch = (epoch.results ?? [])[0]?.current_epoch ?? 1;

    const now = new Date().toISOString();
    await env.BOARD
      .prepare(
        "INSERT INTO r15_device (device_id, owner_ref, sig_pub, enc_pub, label, added_at, added_by, revoked_at, last_epoch) " +
          "VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, '', 0)",
      )
      .bind(d.deviceId, auth.device.owner_ref, d.sigPub, d.encPub, label, now, auth.device.device_id)
      .run();
    return json({ ok: true, deviceId: d.deviceId, ownerRef: auth.device.owner_ref, epoch: curEpoch, existing: false }, 201);
  } catch {
    return json({ ok: false, error: "device_add_failed" }, 500);
  }
};

export const onRequestOptions: PagesFunction<MeshEnv> = async () =>
  new Response(null, { status: 204, headers: { Allow: "POST, OPTIONS" } });
