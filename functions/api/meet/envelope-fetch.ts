// POST /api/meet/envelope-fetch — 自分宛ての封筒を受け取りに行く（pull・通知なし）。
//
// R2 0013: 返すのは ciphertext のまま — 開封は端末。あわせて read 時の規則の
// 機械的実行（cron なし・PX の判断なし）を二つ行う:
//   1. TTL 超過の held（流れる封筒のみ）→ expired tombstone（ciphertext を落とす）。
//      不達は両者に正直な一行 — sender 宛てにも mine=true で serve する。
//   2. closed edge のノート削除 — 縁が閉じれば立て札も畳まれる（invariant 3）。
//
// ここに「配達済み」「既読」を作らない: fetch は受け手自身の行為であり、送り手の
// UI には何も生まれない（ack は invariant 2 の内部信号 — envelope-ack.ts）。

import {
  json,
  deriveParticipantRef,
  isOwnerToken,
  isAllowedWriteOrigin,
  ENVELOPE_TTL_DAYS,
  type MeetEnv,
} from "../../_meet.ts";

interface EnvRow {
  envelope_id: string;
  edge_id: string;
  from_ref: string;
  kind: string;
  eph_pub: string;
  iv: string;
  ciphertext: string;
  state: string;
  created_at: string;
}

export const onRequestPost: PagesFunction<MeetEnv> = async ({ request, env }) => {
  if (!isAllowedWriteOrigin(request)) return json({ ok: false, error: "bad_origin" }, 403);

  const raw = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (raw === null || !isOwnerToken(raw.ownerToken)) return json({ ok: false, error: "token" }, 400);
  const me = await deriveParticipantRef(raw.ownerToken);

  try {
    const cutoff = new Date(Date.now() - ENVELOPE_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
    // read 時の規則の機械的実行（PX の判断ではない — 期限とclosedは事実）
    await env.BOARD.batch([
      // 1. 不達 TTL: 流れる封筒だけが期限切れる（ノートは立つ — invariant 3）
      env.BOARD
        .prepare(
          "UPDATE r15_envelope SET state = 'expired', ciphertext = '' " +
            "WHERE state = 'held' AND kind != 'note' AND created_at < ?1",
        )
        .bind(cutoff),
      // 2. 縁が閉じれば立て札も畳まれる
      env.BOARD.prepare(
        "DELETE FROM r15_envelope WHERE kind = 'note' AND edge_id IN " +
          "(SELECT edge_id FROM r15_edge WHERE state = 'closed')",
      ),
    ]);

    // 自分が participant の edge で、相手が出したもの（held）＋ 期限切れ（双方）
    const rows = await env.BOARD
      .prepare(
        "SELECT v.envelope_id, v.edge_id, v.from_ref, v.kind, v.eph_pub, v.iv, v.ciphertext, v.state, v.created_at " +
          "FROM r15_envelope v JOIN r15_edge e ON v.edge_id = e.edge_id " +
          "WHERE (e.a_ref = ?1 OR e.b_ref = ?1) " +
          "AND (v.state = 'expired' OR v.from_ref != ?1) " +
          "ORDER BY v.created_at",
      )
      .bind(me)
      .all<EnvRow>();

    const incoming = [];
    const expired = [];
    for (const r of rows.results ?? []) {
      if (r.state === "expired") {
        // 不達の正直な一行の材料 — 本文はもう存在しない（ciphertext は落とし済み）
        expired.push({
          envelopeId: r.envelope_id,
          edgeId: r.edge_id,
          kind: r.kind,
          mine: r.from_ref === me,
          createdAt: r.created_at,
        });
      } else {
        incoming.push({
          envelopeId: r.envelope_id,
          edgeId: r.edge_id,
          fromRef: r.from_ref,
          kind: r.kind,
          ephPub: r.eph_pub,
          iv: r.iv,
          ciphertext: r.ciphertext,
          createdAt: r.created_at,
        });
      }
    }
    return json({ ok: true, incoming, expired });
  } catch {
    return json({ ok: false, error: "fetch_failed" }, 500);
  }
};

export const onRequestOptions: PagesFunction<MeetEnv> = async () =>
  new Response(null, { status: 204, headers: { Allow: "POST, OPTIONS" } });
