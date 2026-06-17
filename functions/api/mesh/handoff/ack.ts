// POST /api/mesh/handoff/ack — 新端末が復号成功後に受領を ACK → payload を即削除（purge）。
//
// 設計: docs/r2/device-mesh-how-v0.3.md §5/§13 G4。handoff は単一宛先（to_device=自分）なので
// ACK = 物理削除（relay を蓄積場にしない）。署名 = 新端末 device_sig。自分宛て以外は消せない。

import { json, isAllowedWriteOrigin, isMeshPayloadId, verifySignedRequest, type MeshEnv } from "../../../_mesh.ts";

export const onRequestPost: PagesFunction<MeshEnv> = async ({ request, env }) => {
  if (!isAllowedWriteOrigin(request)) return json({ ok: false, error: "bad_origin" }, 403);
  const raw = (await request.json().catch(() => null)) as unknown;
  const auth = await verifySignedRequest(env, raw);
  if (!auth.ok) return json({ ok: false, error: auth.error }, auth.status);

  const ids = auth.data.payloadIds;
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 128) return json({ ok: false, error: "payload_ids" }, 400);
  const clean = ids.filter((x): x is string => isMeshPayloadId(x));
  if (clean.length === 0) return json({ ok: false, error: "payload_ids" }, 400);

  const me = auth.device.device_id;
  const placeholders = clean.map((_, i) => `?${i + 2}`).join(", ");
  try {
    // 自分宛ての handoff 片だけ削除（他人宛ては触れない）。
    await env.BOARD
      .prepare(
        `DELETE FROM r15_mesh_payload WHERE to_device = ?1 AND ptype='handoff' AND payload_id IN (${placeholders})`,
      )
      .bind(me, ...clean)
      .run();
    return json({ ok: true, acked: clean.length });
  } catch {
    return json({ ok: false, error: "ack_failed" }, 500);
  }
};

export const onRequestOptions: PagesFunction<MeshEnv> = async () =>
  new Response(null, { status: 204, headers: { Allow: "POST, OPTIONS" } });
