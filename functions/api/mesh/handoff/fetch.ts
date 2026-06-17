// POST /api/mesh/handoff/fetch — 新端末が自分宛ての handoff 片を取得する（署名つき）。
//
// 設計: docs/r2/device-mesh-how-v0.3.md §5/§13 G4。署名 = 新端末 device_sig（else 401・revoked も 401）。
// read-time に 72h 超過を expired 化（ciphertext 消去）→ 期限切れは返さない。body は暗号文のみ。
// presence は一切返さない（counterparty・端末数・最終取得を出さない）。

import { json, isAllowedWriteOrigin, verifySignedRequest, type MeshEnv } from "../../../_mesh.ts";

export const onRequestPost: PagesFunction<MeshEnv> = async ({ request, env }) => {
  if (!isAllowedWriteOrigin(request)) return json({ ok: false, error: "bad_origin" }, 403);
  const raw = (await request.json().catch(() => null)) as unknown;
  const auth = await verifySignedRequest(env, raw);
  if (!auth.ok) return json({ ok: false, error: auth.error }, auth.status);

  const me = auth.device.device_id;
  const now = new Date().toISOString();
  try {
    // 72h 超過は expired tombstone（ciphertext 消去）— fetch では返さない。
    await env.BOARD
      .prepare(
        "UPDATE r15_mesh_payload SET state='expired', ciphertext='' " +
          "WHERE to_device=?1 AND ptype='handoff' AND state='held' AND expires_at < ?2",
      )
      .bind(me, now)
      .run();
    const found = await env.BOARD
      .prepare(
        "SELECT payload_id, chunk_ix, chunk_of, eph_pub, iv, ciphertext FROM r15_mesh_payload " +
          "WHERE to_device=?1 AND ptype='handoff' AND state='held' ORDER BY chunk_ix ASC",
      )
      .bind(me)
      .all<{ payload_id: string; chunk_ix: number; chunk_of: number; eph_pub: string; iv: string; ciphertext: string }>();
    const chunks = (found.results ?? []).map((r) => ({
      payloadId: r.payload_id,
      ix: r.chunk_ix,
      of: r.chunk_of,
      ephPub: r.eph_pub,
      iv: r.iv,
      ciphertext: r.ciphertext,
    }));
    return json({ ok: true, chunks });
  } catch {
    return json({ ok: false, error: "fetch_failed" }, 500);
  }
};

export const onRequestOptions: PagesFunction<MeshEnv> = async () =>
  new Response(null, { status: 204, headers: { Allow: "POST, OPTIONS" } });
