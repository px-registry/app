// POST /api/mesh/handoff/put — 既存端末が新端末（QR の did）へ handoff bundle を投函する。
//
// 設計: docs/r2/device-mesh-how-v0.3.md §5/§13 G1·G4。Phase B（裁定 B-1）。
// 署名 = 既存 active 端末（verifySignedRequest）。宛先 toDevice は **同 owner 配下の登録端末**のみ
// （他人/失効端末へは投函不可）。body は暗号文のみ（PX は平文を持たない）。72h hard TTL。
// 封緘宛先は QR の encPub（client 責務）— サーバは ciphertext を運ぶだけで鍵の出所を判定しない。

import {
  json,
  isAllowedWriteOrigin,
  isDeviceId,
  isB64,
  validPubStr,
  verifySignedRequest,
  mintPayloadId,
  HANDOFF_TTL_HOURS,
  MAX_HANDOFF_CHUNKS,
  MAX_CIPHERTEXT_B64,
  type MeshEnv,
} from "../../../_mesh.ts";

export const onRequestPost: PagesFunction<MeshEnv> = async ({ request, env }) => {
  if (!isAllowedWriteOrigin(request)) return json({ ok: false, error: "bad_origin" }, 403);
  const raw = (await request.json().catch(() => null)) as unknown;
  const auth = await verifySignedRequest(env, raw);
  if (!auth.ok) return json({ ok: false, error: auth.error }, auth.status);

  const toDevice = auth.data.toDevice;
  if (!isDeviceId(toDevice)) return json({ ok: false, error: "to_device" }, 400);
  const chunks = auth.data.chunks;
  if (!Array.isArray(chunks) || chunks.length === 0 || chunks.length > MAX_HANDOFF_CHUNKS) {
    return json({ ok: false, error: "chunks" }, 400);
  }

  // 宛先は同 owner 配下の **登録・非失効** 端末のみ（他人の端末・失効端末へは送れない）。
  let target: { owner_ref: string; revoked_at: string } | undefined;
  try {
    const found = await env.BOARD
      .prepare("SELECT owner_ref, revoked_at FROM r15_device WHERE device_id = ?1")
      .bind(toDevice)
      .all<{ owner_ref: string; revoked_at: string }>();
    target = (found.results ?? [])[0];
  } catch {
    return json({ ok: false, error: "lookup_failed" }, 500);
  }
  if (target === undefined || target.owner_ref !== auth.device.owner_ref || target.revoked_at !== "") {
    return json({ ok: false, error: "to_device_not_found" }, 404);
  }

  const of = chunks.length;
  const now = Date.now();
  const createdAt = new Date(now).toISOString();
  const expiresAt = new Date(now + HANDOFF_TTL_HOURS * 60 * 60 * 1000).toISOString();
  const stmts = [];
  const seenIx = new Set<number>();
  for (const c of chunks) {
    if (typeof c !== "object" || c === null) return json({ ok: false, error: "chunk_shape" }, 400);
    const ch = c as Record<string, unknown>;
    if (typeof ch.ix !== "number" || ch.ix < 0 || ch.ix >= of || seenIx.has(ch.ix)) {
      return json({ ok: false, error: "chunk_ix" }, 400);
    }
    if (ch.of !== of) return json({ ok: false, error: "chunk_of" }, 400);
    if (!validPubStr(ch.ephPub)) return json({ ok: false, error: "eph_pub" }, 400);
    if (!isB64(ch.iv)) return json({ ok: false, error: "iv" }, 400);
    if (!isB64(ch.ciphertext) || (ch.ciphertext as string).length > MAX_CIPHERTEXT_B64) {
      return json({ ok: false, error: "ciphertext" }, 400);
    }
    seenIx.add(ch.ix);
    stmts.push(
      env.BOARD
        .prepare(
          "INSERT INTO r15_mesh_payload " +
            "(payload_id, audience_ref, lane, ptype, epoch, wrap_to, to_device, eph_pub, iv, ciphertext, chunk_ix, chunk_of, state, created_at, expires_at) " +
            "VALUES (?1, ?2, 'self', 'handoff', 0, 'device', ?3, ?4, ?5, ?6, ?7, ?8, 'held', ?9, ?10)",
        )
        .bind(
          mintPayloadId(),
          auth.device.owner_ref,
          toDevice,
          ch.ephPub,
          ch.iv,
          ch.ciphertext,
          ch.ix,
          of,
          createdAt,
          expiresAt,
        ),
    );
  }

  try {
    await env.BOARD.batch(stmts);
    return json({ ok: true, count: of, expiresAt }, 201);
  } catch {
    return json({ ok: false, error: "put_failed" }, 500);
  }
};

export const onRequestOptions: PagesFunction<MeshEnv> = async () =>
  new Response(null, { status: 204, headers: { Allow: "POST, OPTIONS" } });
