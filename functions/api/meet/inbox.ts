// POST /api/meet/inbox — what this owner may see about edges and contact.
//
// POST (not GET) so the owner token travels in the body, never in a URL.
// R2 0010: signals are EDGE rows now. Returns, for the CALLER only:
//   incoming — edges addressed to me (sender pseudonym, anchor, basis, state)
//   outgoing — edges I opened (so the UI shows sent-state PER CARD, not per peer)
//   myItems  — the caller's own public rows (チャットポートの reverse-import 材料)
//
// R2 GOAL 小掃除: 平文 contact note の serve（notes/myNotes）は退場 — 渡すは
// E2EE 封筒だけ（カットオーバー Phase 3 で平文 0 件を確認済・R8 hook が復活を
// 遮断）。r15_contact_note の表は档案として残る（行は読まれない）。
//
// Closed edges are served too — the honest fact, shown before pressing (c18b
// lineage); the UI words it, the server never hides it.

import {
  json,
  deriveParticipantRef,
  isOwnerToken,
  isAllowedWriteOrigin,
  deriveDormant,
  parseTagsJson,
  type MeetEnv,
} from "../../_meet.ts";

interface InEdgeRow {
  edge_id: string;
  a_ref: string;
  from_name: string;
  from_intro: string;
  basis_item_ref: string;
  anchor: string;
  state: string;
  closed_by: string;
  closed_from: string;
  created_at: string;
  last_act_a_at: string;
  last_act_b_at: string;
}
interface OutEdgeRow {
  edge_id: string;
  b_ref: string;
  to_name: string;
  basis_item_ref: string;
  anchor: string;
  state: string;
  closed_by: string;
  closed_from: string;
  created_at: string;
  last_act_a_at: string;
  last_act_b_at: string;
}
export const onRequestPost: PagesFunction<MeetEnv> = async ({ request, env }) => {
  if (!isAllowedWriteOrigin(request)) return json({ ok: false, error: "bad_origin" }, 403);

  const raw = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (raw === null || !isOwnerToken(raw.ownerToken)) return json({ ok: false, error: "token" }, 400);
  const me = await deriveParticipantRef(raw.ownerToken);

  try {
    const incoming = await env.BOARD
      .prepare(
        "SELECT e.edge_id, e.a_ref, e.from_name, e.basis_item_ref, e.anchor, e.state, " +
          "e.closed_by, e.closed_from, e.created_at, e.last_act_a_at, e.last_act_b_at, " +
          // sender's CURRENT published ひとこと紹介 (公開射影の一部; '' = unset/departed)
          "COALESCE((SELECT p.intro FROM r15_pool_item p WHERE p.participant_ref = e.a_ref ORDER BY p.position LIMIT 1), '') AS from_intro " +
          "FROM r15_edge e WHERE e.b_ref = ?1 ORDER BY e.created_at",
      )
      .bind(me)
      .all<InEdgeRow>();

    // 便3: a 側の pair 面（mutual 後の前室）は outgoing で建つ — to_name と anchor
    // を一緒に serve する（to_name は送信時点固定・from_name と同格）。
    const outgoing = await env.BOARD
      .prepare(
        "SELECT edge_id, b_ref, to_name, basis_item_ref, anchor, state, closed_by, " +
          "closed_from, created_at, last_act_a_at, last_act_b_at " +
          "FROM r15_edge WHERE a_ref = ?1 ORDER BY created_at",
      )
      .bind(me)
      .all<OutEdgeRow>();

    // R2 GOAL（チャットポート）— 自分の公開面の写し。port が additive に立てた
    // アンテナを端末が次回訪問で取り込む（reverse-import）ための serve。自分の
    // 公開行を自分に返すだけ — 新しい custody はない（additive key・黄申告済）。
    const myItems = await env.BOARD
      .prepare(
        "SELECT item_ref, kind, title, text, tags, business FROM r15_pool_item " +
          "WHERE participant_ref = ?1 ORDER BY position",
      )
      .bind(me)
      .all<{ item_ref: string; kind: string; title: string; text: string; tags: string; business: number }>();

    // 気配 (第9便 C): today's read-count per OWN placed question — counts only,
    // served back to their owner (a fact, not a score).
    const day = new Date().toISOString().slice(0, 10);
    const reads = await env.BOARD
      .prepare(
        "SELECT position, COUNT(*) AS n FROM r15_question_serve WHERE owner_ref = ?1 AND day = ?2 GROUP BY position",
      )
      .bind(me, day)
      .all<{ position: number; n: number }>();

    // 便3 — dormant は読み時導出（状態ではない・invariant 1/2）。closed の出自は
    // closedByMe の真偽だけ serve する: 自分の行為は自分が知っている、相手側には
    // 一語の事実だけ — 終わり方を語り分けない（invariant 4 の表示版）。
    const now = new Date();
    return json({
      ok: true,
      incoming: (incoming.results ?? []).map((r) => ({
        edgeId: r.edge_id,
        fromRef: r.a_ref,
        fromName: r.from_name,
        fromIntro: r.from_intro,
        basisItemRef: r.basis_item_ref,
        anchor: r.anchor,
        state: r.state,
        closedByMe: r.state === "closed" && r.closed_by === me,
        closedFrom: r.closed_from,
        dormant: deriveDormant(r.state, r.created_at, r.last_act_a_at, r.last_act_b_at, now),
        createdAt: r.created_at,
      })),
      outgoing: (outgoing.results ?? []).map((r) => ({
        edgeId: r.edge_id,
        toRef: r.b_ref,
        toName: r.to_name,
        basisItemRef: r.basis_item_ref,
        anchor: r.anchor,
        state: r.state,
        closedByMe: r.state === "closed" && r.closed_by === me,
        closedFrom: r.closed_from,
        dormant: deriveDormant(r.state, r.created_at, r.last_act_a_at, r.last_act_b_at, now),
        createdAt: r.created_at,
      })),
      myItems: (myItems.results ?? []).map((r) => ({
        itemRef: r.item_ref,
        kind: r.kind,
        title: r.title,
        text: r.text,
        tags: parseTagsJson(r.tags),
        business: r.business === 1,
      })),
      questionReads: (reads.results ?? []).map((r) => ({ position: r.position, count: r.n })),
    });
  } catch {
    return json({ ok: false, error: "inbox_failed" }, 500);
  }
};

export const onRequestOptions: PagesFunction<MeetEnv> = async () =>
  new Response(null, { status: 204, headers: { Allow: "POST, OPTIONS" } });
