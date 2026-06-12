// POST /api/meet/envelope-ack — 受信完了の内部信号（行削除トリガー）。
//
// R2 0013 invariant 2（ゲート条件2・UI 非接続に固定）: ack はサーバの行削除
// トリガーであり、**相手に通知されない・相手の UI に状態を作らない**。既読の
// 裏口をここから開けない — レスポンスにも相手向けの何かを足さない。
//
// 消せるもの: 自分宛ての held（流れる封筒 — 端末保存が済んだ合図）／自分が
// participant の expired tombstone（正直な一行を見終えた後の片づけ）。
// ノートは ack で消えない（standing — 下げるのは author 自身の上書き/edge の閉じ）。

import {
  json,
  deriveParticipantRef,
  isOwnerToken,
  isEnvelopeId,
  isAllowedWriteOrigin,
  type MeetEnv,
} from "../../_meet.ts";

export const onRequestPost: PagesFunction<MeetEnv> = async ({ request, env }) => {
  if (!isAllowedWriteOrigin(request)) return json({ ok: false, error: "bad_origin" }, 403);

  const raw = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (raw === null || !isOwnerToken(raw.ownerToken)) return json({ ok: false, error: "token" }, 400);
  const ids = Array.isArray(raw.envelopeIds) ? raw.envelopeIds.filter(isEnvelopeId) : [];
  if (ids.length === 0 || ids.length > 100) return json({ ok: false, error: "envelope_ids" }, 400);

  const me = await deriveParticipantRef(raw.ownerToken);

  try {
    // 受け手（宛先）であることを edge join で確認してから消す。
    // held は from_ref != me（相手が出した・自分が受けた）のみ。
    // expired は participant ならどちらでも片づけられる。
    const placeholders = ids.map((_, i) => `?${i + 2}`).join(", ");
    await env.BOARD
      .prepare(
        `DELETE FROM r15_envelope WHERE envelope_id IN (${placeholders}) AND kind != 'note' ` +
          "AND edge_id IN (SELECT edge_id FROM r15_edge WHERE a_ref = ?1 OR b_ref = ?1) " +
          "AND (state = 'expired' OR from_ref != ?1)",
      )
      .bind(me, ...ids)
      .run();
    return json({ ok: true });
  } catch {
    return json({ ok: false, error: "ack_failed" }, 500);
  }
};

export const onRequestOptions: PagesFunction<MeetEnv> = async () =>
  new Response(null, { status: 204, headers: { Allow: "POST, OPTIONS" } });
