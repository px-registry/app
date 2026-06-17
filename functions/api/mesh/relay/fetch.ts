// POST /api/mesh/relay/fetch — 自分（owner）宛の未受領 delta を取得（Phase C・G5）。
//
// 設計: docs/r2/device-mesh-how-v0.3.md §4.3/§4.7/§13 G5。署名 = 取得端末（device_sig）。
// **この端末がまだ ACK していない** held・非 expired の epoch-wrap payload だけを返す（多端末取り逃しなし）。
// read-time に 14日超過を expired 化（fetch 不可）。**counterparty の ack・端末数・presence は一切返さない**。

import { json, isAllowedWriteOrigin, verifySignedRequest, type MeshEnv } from "../../../_mesh.ts";

export const onRequestPost: PagesFunction<MeshEnv> = async ({ request, env }) => {
  if (!isAllowedWriteOrigin(request)) return json({ ok: false, error: "bad_origin" }, 403);
  const raw = (await request.json().catch(() => null)) as unknown;
  const auth = await verifySignedRequest(env, raw);
  if (!auth.ok) return json({ ok: false, error: auth.error }, auth.status);

  const owner = auth.device.owner_ref;
  const me = auth.device.device_id;
  const now = new Date().toISOString();
  try {
    await env.BOARD
      .prepare(
        "UPDATE r15_mesh_payload SET state='expired', ciphertext='' " +
          "WHERE audience_ref=?1 AND wrap_to='epoch' AND state='held' AND expires_at < ?2",
      )
      .bind(owner, now)
      .run();
    const found = await env.BOARD
      .prepare(
        "SELECT payload_id, lane, ptype, epoch, eph_pub, iv, ciphertext FROM r15_mesh_payload " +
          "WHERE audience_ref=?1 AND wrap_to='epoch' AND state='held' " +
          "AND payload_id NOT IN (SELECT payload_id FROM r15_mesh_ack WHERE device_id=?2) " +
          "ORDER BY created_at ASC",
      )
      .bind(owner, me)
      .all<{ payload_id: string; lane: string; ptype: string; epoch: number; eph_pub: string; iv: string; ciphertext: string }>();
    const payloads = (found.results ?? []).map((r) => ({
      payloadId: r.payload_id,
      lane: r.lane,
      ptype: r.ptype,
      epoch: r.epoch,
      ephPub: r.eph_pub,
      iv: r.iv,
      ciphertext: r.ciphertext,
    }));
    return json({ ok: true, payloads });
  } catch {
    return json({ ok: false, error: "fetch_failed" }, 500);
  }
};

export const onRequestOptions: PagesFunction<MeshEnv> = async () =>
  new Response(null, { status: 204, headers: { Allow: "POST, OPTIONS" } });
