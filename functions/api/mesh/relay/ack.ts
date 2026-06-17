// POST /api/mesh/relay/ack — per-device 受領 ACK ＋ 全 active ACK で purge（Phase C・G5）。
//
// 設計: docs/r2/device-mesh-how-v0.3.md §4.4/§4.5/§13 G5。署名 = 受領端末（device_sig）。
// ACK は (payload_id, device_id) を記録するだけ＝**最初の1台では消さない**。全 active device が ACK して
// 初めて purge（purgeFullyAcked）。ack 行は内部資料 — 応答は件数だけ（counterparty/presence に出さない）。

import {
  json,
  isAllowedWriteOrigin,
  isMeshPayloadId,
  verifySignedRequest,
  purgeFullyAcked,
  type MeshEnv,
} from "../../../_mesh.ts";

export const onRequestPost: PagesFunction<MeshEnv> = async ({ request, env }) => {
  if (!isAllowedWriteOrigin(request)) return json({ ok: false, error: "bad_origin" }, 403);
  const raw = (await request.json().catch(() => null)) as unknown;
  const auth = await verifySignedRequest(env, raw);
  if (!auth.ok) return json({ ok: false, error: auth.error }, auth.status);

  const ids = auth.data.payloadIds;
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 256) return json({ ok: false, error: "payload_ids" }, 400);
  const clean = ids.filter((x): x is string => isMeshPayloadId(x));
  if (clean.length === 0) return json({ ok: false, error: "payload_ids" }, 400);

  const owner = auth.device.owner_ref;
  const me = auth.device.device_id;
  const now = new Date().toISOString();
  try {
    // 自分の owner 宛の payload にだけ ACK を打つ（他人の payload は数えない）。
    const stmts = clean.map((pid) =>
      env.BOARD
        .prepare(
          "INSERT OR IGNORE INTO r15_mesh_ack (payload_id, device_id, acked_at) " +
            "SELECT ?1, ?2, ?3 WHERE EXISTS (SELECT 1 FROM r15_mesh_payload WHERE payload_id=?1 AND audience_ref=?4)",
        )
        .bind(pid, me, now, owner),
    );
    await env.BOARD.batch(stmts);
    // 全 active device ACK 済みのものだけ purge（最初の1台では消えない）。
    await purgeFullyAcked(env, owner, clean);
    return json({ ok: true, acked: clean.length });
  } catch {
    return json({ ok: false, error: "ack_failed" }, 500);
  }
};

export const onRequestOptions: PagesFunction<MeshEnv> = async () =>
  new Response(null, { status: 204, headers: { Allow: "POST, OPTIONS" } });
