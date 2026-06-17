// POST /api/mesh/revoke — 端末を外す＋epoch rotation（verdict G2 の拘束順）。
//
// 設計: docs/r2/device-mesh-how-v0.3.md §3.5/§13 G2。署名 = 残す側の active 端末（owner 本人）。
// data = { targetDeviceId, newEpochPub }。
//
// 順序（G2）:
//   1. relay fetch 停止：target.revoked_at セット（以後 verifySignedRequest が revoked を 401）
//   2. purge：target 宛の未配送 payload（to_device=target）＋その ack を即 delete
//   3. rotate：旧 epoch inactive 化 → 新 epoch(active) 挿入 → current_epoch 繰り上げ（rotateEpoch）
//   4. 以後 delta は新 epoch public のみ宛先（put 側 stale-epoch 409＝Phase C で enforce）
// ※新 epoch private の active 端末への配布（ptype=epoch-key relay）は Phase C。ここは registry まで。

import {
  json,
  isAllowedWriteOrigin,
  isDeviceId,
  validPubStr,
  verifySignedRequest,
  rotateEpoch,
  type MeshEnv,
} from "../../_mesh.ts";

export const onRequestPost: PagesFunction<MeshEnv> = async ({ request, env }) => {
  if (!isAllowedWriteOrigin(request)) return json({ ok: false, error: "bad_origin" }, 403);
  const raw = (await request.json().catch(() => null)) as unknown;
  const auth = await verifySignedRequest(env, raw);
  if (!auth.ok) return json({ ok: false, error: auth.error }, auth.status);

  const targetDeviceId = auth.data.targetDeviceId;
  if (!isDeviceId(targetDeviceId)) return json({ ok: false, error: "target" }, 400);
  if (!validPubStr(auth.data.newEpochPub)) return json({ ok: false, error: "epoch_pub" }, 400);
  const ownerRef = auth.device.owner_ref;

  try {
    // target は同 owner 配下であること（他人の端末を外せない）。
    const tgt = await env.BOARD
      .prepare("SELECT owner_ref, revoked_at FROM r15_device WHERE device_id = ?1")
      .bind(targetDeviceId)
      .all<{ owner_ref: string; revoked_at: string }>();
    const row = (tgt.results ?? [])[0];
    if (row === undefined || row.owner_ref !== ownerRef) return json({ ok: false, error: "not_found" }, 404);

    const now = new Date().toISOString();
    // 1. relay fetch 停止（revoked_at）— 冪等（既に revoked でも進める）。
    await env.BOARD
      .prepare("UPDATE r15_device SET revoked_at = ?2 WHERE device_id = ?1 AND revoked_at = ''")
      .bind(targetDeviceId, now)
      .run();
    // 2. purge：target 宛の未配送 payload ＋ ack（revoke 対象に渡るはずだった分を残さない）。
    await env.BOARD.batch([
      env.BOARD.prepare("DELETE FROM r15_mesh_payload WHERE to_device = ?1").bind(targetDeviceId),
      env.BOARD.prepare("DELETE FROM r15_mesh_ack WHERE device_id = ?1").bind(targetDeviceId),
    ]);
    // 3. rotate（旧 inactive→新 active→current_epoch 繰り上げ）。
    const next = await rotateEpoch(env, ownerRef, auth.data.newEpochPub as string);
    return json({ ok: true, ownerRef, revoked: targetDeviceId, epoch: next });
  } catch {
    return json({ ok: false, error: "revoke_failed" }, 500);
  }
};

export const onRequestOptions: PagesFunction<MeshEnv> = async () =>
  new Response(null, { status: 204, headers: { Allow: "POST, OPTIONS" } });
