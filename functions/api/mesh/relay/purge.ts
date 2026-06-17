// POST /api/mesh/relay/purge — owner 全消去（exit-safe）。自分宛の relay payload を実消去する。
//
// 設計: docs/r2/device-mesh-how-v0.3.md §4.5/§13 G5（owner purge）。署名 = owner の端末。
// 「このPXのMemoryとTalkを消す」の server 側＝自分が audience の epoch-wrap payload と ack を実削除。
// 相手の端末にある会話には触れない（audience が相手の payload は対象外）。

import { json, isAllowedWriteOrigin, verifySignedRequest, type MeshEnv } from "../../../_mesh.ts";

export const onRequestPost: PagesFunction<MeshEnv> = async ({ request, env }) => {
  if (!isAllowedWriteOrigin(request)) return json({ ok: false, error: "bad_origin" }, 403);
  const raw = (await request.json().catch(() => null)) as unknown;
  const auth = await verifySignedRequest(env, raw);
  if (!auth.ok) return json({ ok: false, error: auth.error }, auth.status);

  const owner = auth.device.owner_ref;
  try {
    await env.BOARD.batch([
      env.BOARD.prepare(
        "DELETE FROM r15_mesh_ack WHERE payload_id IN (SELECT payload_id FROM r15_mesh_payload WHERE audience_ref=?1)",
      ).bind(owner),
      env.BOARD.prepare("DELETE FROM r15_mesh_payload WHERE audience_ref=?1").bind(owner),
    ]);
    return json({ ok: true });
  } catch {
    return json({ ok: false, error: "purge_failed" }, 500);
  }
};

export const onRequestOptions: PagesFunction<MeshEnv> = async () =>
  new Response(null, { status: 204, headers: { Allow: "POST, OPTIONS" } });
