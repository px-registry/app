// POST /api/mesh/handoff/cancel — owner（既存端末）が未配送の handoff を取り消す（削除）。
//
// 設計: docs/r2/device-mesh-how-v0.3.md §13 G4（owner cancel 削除）。署名 = 既存 active 端末。
// 対象 toDevice は同 owner 配下のみ。未配送 payload を物理削除（relay を蓄積場にしない）。

import { json, isAllowedWriteOrigin, isDeviceId, verifySignedRequest, type MeshEnv } from "../../../_mesh.ts";

export const onRequestPost: PagesFunction<MeshEnv> = async ({ request, env }) => {
  if (!isAllowedWriteOrigin(request)) return json({ ok: false, error: "bad_origin" }, 403);
  const raw = (await request.json().catch(() => null)) as unknown;
  const auth = await verifySignedRequest(env, raw);
  if (!auth.ok) return json({ ok: false, error: auth.error }, auth.status);

  const toDevice = auth.data.toDevice;
  if (!isDeviceId(toDevice)) return json({ ok: false, error: "to_device" }, 400);

  try {
    // toDevice が同 owner 配下であること（他人の handoff は取り消せない）。
    const found = await env.BOARD
      .prepare("SELECT owner_ref FROM r15_device WHERE device_id = ?1")
      .bind(toDevice)
      .all<{ owner_ref: string }>();
    const row = (found.results ?? [])[0];
    if (row === undefined || row.owner_ref !== auth.device.owner_ref) {
      return json({ ok: false, error: "not_found" }, 404);
    }
    const del = await env.BOARD
      .prepare("DELETE FROM r15_mesh_payload WHERE to_device = ?1 AND ptype='handoff'")
      .bind(toDevice)
      .run();
    return json({ ok: true, cancelled: del.meta?.changes ?? 0 });
  } catch {
    return json({ ok: false, error: "cancel_failed" }, 500);
  }
};

export const onRequestOptions: PagesFunction<MeshEnv> = async () =>
  new Response(null, { status: 204, headers: { Allow: "POST, OPTIONS" } });
