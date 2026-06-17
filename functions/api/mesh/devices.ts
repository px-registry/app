// POST /api/mesh/devices — 自分（owner）の接続済み端末一覧（署名つき・「接続済みの端末」UI 用）。
//
// 設計: docs/r2/device-mesh-how-v0.3.md §7.2。認可 = device_sig 署名（owner_ref を署名から解決）。
// 返すのは **自分の owner 配下の公開メタだけ**（device_id/label/added_at/revoked）。
// presence は無い（最終取得・オンライン等は持たない・返さない）。counterparty へは出さない設計。
// POST だが read-only（署名で本人確認するため body が要る）。

import { json, isAllowedWriteOrigin, verifySignedRequest, type MeshEnv } from "../../_mesh.ts";

export const onRequestPost: PagesFunction<MeshEnv> = async ({ request, env }) => {
  if (!isAllowedWriteOrigin(request)) return json({ ok: false, error: "bad_origin" }, 403);

  const raw = (await request.json().catch(() => null)) as unknown;
  const auth = await verifySignedRequest(env, raw);
  if (!auth.ok) return json({ ok: false, error: auth.error }, auth.status);

  try {
    const found = await env.BOARD
      .prepare(
        "SELECT device_id, label, added_at, revoked_at FROM r15_device WHERE owner_ref = ?1 ORDER BY added_at ASC",
      )
      .bind(auth.device.owner_ref)
      .all<{ device_id: string; label: string; added_at: string; revoked_at: string }>();
    const devices = (found.results ?? []).map((r) => ({
      deviceId: r.device_id,
      label: r.label,
      addedAt: r.added_at,
      revoked: r.revoked_at !== "",
      here: r.device_id === auth.device.device_id,
    }));
    return json({ ok: true, ownerRef: auth.device.owner_ref, devices });
  } catch {
    return json({ ok: false, error: "devices_failed" }, 500);
  }
};

export const onRequestOptions: PagesFunction<MeshEnv> = async () =>
  new Response(null, { status: 204, headers: { Allow: "POST, OPTIONS" } });
