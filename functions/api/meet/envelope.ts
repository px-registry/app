// POST /api/meet/envelope — 投函（メッセージ／ノート／渡す）。
//
// R2 0013: PX は ciphertext を運ぶだけ — **平文を受ける API 形は存在しない**
// （invariant 1）。body に text/plaintext/note らしき平文キーが乗っていたら
// 封筒ごと拒否（c17 tripwire の常時化・private_shape と同じ文法）。
//
// guards:
//   * mutual edge の participant のみ投函できる（invariant 4・SQL 述語）。
//   * ノートは (edge, author) 一枚に upsert（編集 = 再封して出し直し）。
//   * held queue cap = MAX_HELD_PER_EDGE_SENDER（物理律速 — 0013 §4 の「日次N通」は
//     配達後非保持と両立しないため、滞留キュー深さで実装。日次計数の持続はそれ自体
//     メタデータの蓄積になる — 持たない方向の読み替え。設計役へ申告済み）。
//   * 投函は行為 — 送り手側の last_act を動かす（0010 invariant 2）。

import {
  json,
  deriveParticipantRef,
  isOwnerToken,
  isEnvelopeId,
  isAllowedWriteOrigin,
  ENVELOPE_KINDS,
  MAX_CIPHERTEXT_B64,
  MAX_IV_B64,
  MAX_ENC_PUB,
  MAX_HELD_PER_EDGE_SENDER,
  type MeetEnv,
} from "../../_meet.ts";

export const onRequestPost: PagesFunction<MeetEnv> = async ({ request, env }) => {
  if (!isAllowedWriteOrigin(request)) return json({ ok: false, error: "bad_origin" }, 403);

  const raw = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (raw === null || !isOwnerToken(raw.ownerToken)) return json({ ok: false, error: "token" }, 400);
  // invariant 1 tripwire: a plaintext-ish key means something upstream posted
  // an unsealed body — refuse whole, never store.
  if ("text" in raw || "plaintext" in raw || "note" in raw || "body" in raw) {
    return json({ ok: false, error: "plaintext_shape" }, 400);
  }
  if (!isEnvelopeId(raw.envelopeId)) return json({ ok: false, error: "envelope_id" }, 400);
  if (typeof raw.edgeId !== "string" || !/^[A-Za-z0-9_]{6,64}$/.test(raw.edgeId)) {
    return json({ ok: false, error: "edge_id" }, 400);
  }
  if (typeof raw.kind !== "string" || !ENVELOPE_KINDS.has(raw.kind)) {
    return json({ ok: false, error: "kind" }, 400);
  }
  const ephPub = typeof raw.ephPub === "string" ? raw.ephPub : "";
  const iv = typeof raw.iv === "string" ? raw.iv : "";
  const ciphertext = typeof raw.ciphertext === "string" ? raw.ciphertext : "";
  if (ephPub === "" || ephPub.length > MAX_ENC_PUB) return json({ ok: false, error: "eph_pub" }, 400);
  if (iv === "" || iv.length > MAX_IV_B64) return json({ ok: false, error: "iv" }, 400);
  if (ciphertext === "" || ciphertext.length > MAX_CIPHERTEXT_B64) {
    return json({ ok: false, error: "ciphertext" }, 400);
  }

  const me = await deriveParticipantRef(raw.ownerToken);

  try {
    // mutual edge の participant のみ（invariant 4）
    const found = await env.BOARD
      .prepare("SELECT a_ref, b_ref, state FROM r15_edge WHERE edge_id = ?1")
      .bind(raw.edgeId)
      .all<{ a_ref: string; b_ref: string; state: string }>();
    const edge = (found.results ?? [])[0];
    if (edge === undefined) return json({ ok: false, error: "edge_not_found" }, 404);
    if (me !== edge.a_ref && me !== edge.b_ref) {
      return json({ ok: false, error: "not_participant" }, 403);
    }
    if (edge.state !== "mutual") return json({ ok: false, error: "not_mutual" }, 403);

    if (raw.kind !== "note") {
      // 物理律速: 滞留キュー深さ（held のみ — 配達されれば空く）
      const held = await env.BOARD
        .prepare(
          "SELECT COUNT(*) AS n FROM r15_envelope WHERE edge_id = ?1 AND from_ref = ?2 AND state = 'held' AND kind != 'note'",
        )
        .bind(raw.edgeId, me)
        .all<{ n: number }>();
      if ((held.results?.[0]?.n ?? 0) >= MAX_HELD_PER_EDGE_SENDER) {
        return json({ ok: false, error: "queue_full" }, 429);
      }
    }

    const now = new Date().toISOString();
    const actCol = me === edge.a_ref ? "last_act_a_at" : "last_act_b_at";
    const stmts = [
      raw.kind === "note"
        ? // ノートは一人一枚・編集可（standing — 0013 invariant 3）
          env.BOARD
            .prepare(
              "INSERT INTO r15_envelope (envelope_id, edge_id, from_ref, kind, eph_pub, iv, ciphertext, created_at) " +
                "VALUES (?1, ?2, ?3, 'note', ?4, ?5, ?6, ?7) " +
                "ON CONFLICT (edge_id, from_ref) WHERE kind = 'note' DO UPDATE SET " +
                "eph_pub = excluded.eph_pub, iv = excluded.iv, ciphertext = excluded.ciphertext, " +
                "created_at = excluded.created_at, state = 'held'",
            )
            .bind(raw.envelopeId, raw.edgeId, me, ephPub, iv, ciphertext, now)
        : env.BOARD
            .prepare(
              "INSERT INTO r15_envelope (envelope_id, edge_id, from_ref, kind, eph_pub, iv, ciphertext, created_at) " +
                "VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            )
            .bind(raw.envelopeId, raw.edgeId, me, raw.kind, ephPub, iv, ciphertext, now),
      // 投函は行為（0010 invariant 2）
      env.BOARD
        .prepare(`UPDATE r15_edge SET ${actCol} = ?2 WHERE edge_id = ?1`)
        .bind(raw.edgeId, now),
    ];
    await env.BOARD.batch(stmts);
    return json({ ok: true, envelopeId: raw.envelopeId }, 201);
  } catch {
    return json({ ok: false, error: "envelope_failed" }, 500);
  }
};

export const onRequestOptions: PagesFunction<MeetEnv> = async () =>
  new Response(null, { status: 204, headers: { Allow: "POST, OPTIONS" } });
