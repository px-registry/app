// POST /api/mesh/relay/put — Talk message / Memory delta を mesh relay に投函（Phase C・G5/G2）。
//
// 設計: docs/r2/device-mesh-how-v0.3.md §4.2/§13 G5・§15.4。署名 = 送信端末（verifySignedRequest）。
// self lane（memory-delta/talk-mirror）→ audience=自分の owner。peer lane（talk-msg）→ audience=相手 owner。
// **wrap_to='epoch'**・宛先 epoch は audience の active と一致必須（stale-epoch は 409・G2）。
// body は暗号文のみ（epoch_pub 封緘＝PX は平文を持たない）。14日 TTL（expires_at 列）。

import {
  json,
  isAllowedWriteOrigin,
  isOwnerRef,
  isB64,
  validPubStr,
  verifySignedRequest,
  meshWriteGate,
  activeEpoch,
  mintPayloadId,
  MESH_LANES,
  MESH_DELTA_PTYPES,
  MESH_TTL_DAYS,
  MAX_CIPHERTEXT_B64,
  type MeshEnv,
} from "../../../_mesh.ts";

export const onRequestPost: PagesFunction<MeshEnv> = async ({ request, env }) => {
  if (!isAllowedWriteOrigin(request)) return json({ ok: false, error: "bad_origin" }, 403);
  const raw = (await request.json().catch(() => null)) as unknown;
  const auth = await verifySignedRequest(env, raw);
  if (!auth.ok) return json({ ok: false, error: auth.error }, auth.status);

  const { lane, ptype } = auth.data;
  if (typeof lane !== "string" || !MESH_LANES.has(lane)) return json({ ok: false, error: "lane" }, 400);
  if (typeof ptype !== "string" || !MESH_DELTA_PTYPES.has(ptype)) return json({ ok: false, error: "ptype" }, 400);
  // lane と ptype の対応（self=memory-delta/talk-mirror・peer=talk-msg）。
  if (lane === "peer" && ptype !== "talk-msg") return json({ ok: false, error: "lane_ptype" }, 400);
  if (lane === "self" && ptype === "talk-msg") return json({ ok: false, error: "lane_ptype" }, 400);

  // MESH_WRITE gate（server authoritative・送信端末の owner_ref で判定）。
  // 止めるのは **この put（write）だけ** — fetch/ack/purge/revoke/expired cleanup は別経路で不変。
  // 不許可時の honesty（matrix A）: talk-msg は legacy（既存 envelope）へ落とせる＝fallback="legacy"、
  // memory-delta/talk-mirror は legacy 等価が無い＝fallback="none"（client は no-op・Sync 未有効として静かに扱う）。
  // HTTP は 200（真のエラーでない・client が fallback 値で分岐）。client 申告でなくサーバが拒否する。
  const gate = await meshWriteGate(env, auth.device.owner_ref);
  if (!gate.allowed) {
    return json({ ok: false, denied: true, mode: gate.mode, fallback: ptype === "talk-msg" ? "legacy" : "none" });
  }

  const audience = lane === "self" ? auth.device.owner_ref : auth.data.audienceRef;
  if (!isOwnerRef(audience)) return json({ ok: false, error: "audience" }, 400);
  if (typeof auth.data.epoch !== "number") return json({ ok: false, error: "epoch" }, 400);
  if (!validPubStr(auth.data.ephPub)) return json({ ok: false, error: "eph_pub" }, 400);
  if (!isB64(auth.data.iv)) return json({ ok: false, error: "iv" }, 400);
  if (!isB64(auth.data.ciphertext) || (auth.data.ciphertext as string).length > MAX_CIPHERTEXT_B64) {
    return json({ ok: false, error: "ciphertext" }, 400);
  }

  // stale-epoch 拒否（G2）: 宛先の active epoch と一致しなければ 409（古い宛先の新規暗号文を乗せない）。
  const active = await activeEpoch(env, audience);
  if (active === null) return json({ ok: false, error: "no_epoch" }, 404);
  if (auth.data.epoch !== active.epoch) return json({ ok: false, error: "stale_epoch" }, 409);

  const payloadId = mintPayloadId();
  const now = Date.now();
  const createdAt = new Date(now).toISOString();
  const expiresAt = new Date(now + MESH_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
  try {
    const stmts = [
      env.BOARD
        .prepare(
          "INSERT INTO r15_mesh_payload " +
            "(payload_id, audience_ref, lane, ptype, epoch, wrap_to, to_device, eph_pub, iv, ciphertext, chunk_ix, chunk_of, state, created_at, expires_at) " +
            "VALUES (?1, ?2, ?3, ?4, ?5, 'epoch', '', ?6, ?7, ?8, 0, 1, 'held', ?9, ?10)",
        )
        .bind(payloadId, audience, lane, ptype, active.epoch, auth.data.ephPub, auth.data.iv, auth.data.ciphertext, createdAt, expiresAt),
    ];
    // self lane: 送信端末は中身を既に持つ → 自分の ACK を即記録（自己再配送を避け、purge 分母に数える）。
    if (lane === "self") {
      stmts.push(
        env.BOARD
          .prepare("INSERT OR IGNORE INTO r15_mesh_ack (payload_id, device_id, acked_at) VALUES (?1, ?2, ?3)")
          .bind(payloadId, auth.device.device_id, createdAt),
      );
    }
    await env.BOARD.batch(stmts);
    return json({ ok: true, payloadId, epoch: active.epoch, expiresAt }, 201);
  } catch {
    return json({ ok: false, error: "put_failed" }, 500);
  }
};

export const onRequestOptions: PagesFunction<MeshEnv> = async () =>
  new Response(null, { status: 204, headers: { Allow: "POST, OPTIONS" } });
