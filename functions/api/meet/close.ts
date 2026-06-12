// POST /api/meet/close — T3/T4/T5: a live edge closes, by a PARTICIPANT only.
//
// R2 便3 (0010 transition table): T3 = a withdraws a sent edge, T4 = b closes a
// sent edge, T5 = either side closes a mutual edge. Permission collapses to ONE
// rule — the actor must be a participant of a live edge — while the SCHEMA
// keeps who acted (closed_by), with NO reason column (invariant 4): the data
// never classifies the ending, and the UI never words it apart (表示版).
//
// closed is terminal (T6): closing again is the same closing (already:true),
// and reopening does not exist — a re-encounter is a NEW edge via T1 (the
// partial UNIQUE index frees the triple the moment this row leaves 'sent'/'mutual').
// PX itself never writes a transition (invariant 1): no TTL, no cron, no server
// judgment lands here — only this owner-authenticated act.

import {
  json,
  deriveParticipantRef,
  isOwnerToken,
  isAllowedWriteOrigin,
  type MeetEnv,
} from "../../_meet.ts";

// Lookup shape only (covers edge_ and r15pair_); authority is the role check.
function isEdgeIdShape(s: unknown): s is string {
  return typeof s === "string" && /^[A-Za-z0-9_]{6,64}$/.test(s);
}

export const onRequestPost: PagesFunction<MeetEnv> = async ({ request, env }) => {
  if (!isAllowedWriteOrigin(request)) return json({ ok: false, error: "bad_origin" }, 403);

  const raw = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (raw === null || !isOwnerToken(raw.ownerToken)) return json({ ok: false, error: "token" }, 400);
  if (!isEdgeIdShape(raw.edgeId)) return json({ ok: false, error: "edge_id" }, 400);

  const me = await deriveParticipantRef(raw.ownerToken);

  try {
    const found = await env.BOARD
      .prepare("SELECT a_ref, b_ref, state FROM r15_edge WHERE edge_id = ?1")
      .bind(raw.edgeId)
      .all<{ a_ref: string; b_ref: string; state: string }>();
    const edge = (found.results ?? [])[0];
    if (edge === undefined) return json({ ok: false, error: "edge_not_found" }, 404);
    // Role guard: participants only. A stranger learns nothing beyond "not yours".
    if (me !== edge.a_ref && me !== edge.b_ref) {
      return json({ ok: false, error: "not_participant" }, 403);
    }

    if (edge.state === "closed") {
      // T6: closing a closed edge is the same closing — idempotent, and the
      // FIRST actor's record stands (closed_by is never overwritten).
      return json({ ok: true, state: "closed", already: true });
    }

    const now = new Date().toISOString();
    const actCol = me === edge.a_ref ? "last_act_a_at" : "last_act_b_at";
    // 0011: closed_from = the transition SOURCE (a state-machine fact; the
    // gated wording differs for sent-stage vs mutual-stage closes). Not a
    // reason column — invariant 4 stands.
    await env.BOARD
      .prepare(
        `UPDATE r15_edge SET state = 'closed', closed_by = ?2, closed_from = ?4, ${actCol} = ?3 ` +
          "WHERE edge_id = ?1 AND state != 'closed'",
      )
      .bind(raw.edgeId, me, now, edge.state)
      .run();
    return json({ ok: true, state: "closed", already: false }, 201);
  } catch {
    return json({ ok: false, error: "close_failed" }, 500);
  }
};

export const onRequestOptions: PagesFunction<MeetEnv> = async () =>
  new Response(null, { status: 204, headers: { Allow: "POST, OPTIONS" } });
