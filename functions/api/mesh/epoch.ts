// /api/mesh/epoch
//   GET  ?ref=<ownerRef>  — owner の active content epoch 公開鍵（暗号化宛先・公開物）。
//   POST （署名つき）       — 定期巻き直し（rotate）。data = { epochPub }。
//
// 設計: docs/r2/device-mesh-how-v0.3.md §3.3/§3.5/§13 G2。
// public material（enckey と同階級）— private は存在しない。GET は誰でも読める（peer が宛先鍵を得る）。

import {
  json,
  isAllowedWriteOrigin,
  isOwnerRef,
  validPubStr,
  verifySignedRequest,
  activeEpoch,
  rotateEpoch,
  type MeshEnv,
} from "../../_mesh.ts";

export const onRequestGet: PagesFunction<MeshEnv> = async ({ request, env }) => {
  const url = new URL(request.url);
  const ref = url.searchParams.get("ref") ?? "";
  if (!isOwnerRef(ref)) return json({ ok: false, error: "ref" }, 400);
  const ep = await activeEpoch(env, ref);
  if (ep === null) return json({ ok: false, error: "no_epoch" }, 404);
  return json({ ok: true, ownerRef: ref, epoch: ep.epoch, epochPub: ep.epochPub });
};

export const onRequestPost: PagesFunction<MeshEnv> = async ({ request, env }) => {
  if (!isAllowedWriteOrigin(request)) return json({ ok: false, error: "bad_origin" }, 403);
  const raw = (await request.json().catch(() => null)) as unknown;
  const auth = await verifySignedRequest(env, raw);
  if (!auth.ok) return json({ ok: false, error: auth.error }, auth.status);
  if (!validPubStr(auth.data.epochPub)) return json({ ok: false, error: "epoch_pub" }, 400);

  try {
    const next = await rotateEpoch(env, auth.device.owner_ref, auth.data.epochPub as string);
    return json({ ok: true, ownerRef: auth.device.owner_ref, epoch: next }, 201);
  } catch {
    return json({ ok: false, error: "rotate_failed" }, 500);
  }
};

export const onRequestOptions: PagesFunction<MeshEnv> = async () =>
  new Response(null, { status: 204, headers: { Allow: "GET, POST, OPTIONS" } });
