// POST /api/meet/talkback — T2: sent→mutual, written by the ADDRESSEE only.
//
// R2 0010: mutual means "この接点で話したい" aligned on ONE edge — the receiver
// answers the edge they received, they do not open a reverse edge. The b-only
// role guard is the transition table's authority; PX itself never writes a
// transition (invariant 1).
//
// T2 requires NO pool presence (gate §5-b): the edge is a's own recorded
// consent — b may answer after a has left the pool; a reads it on return.
// Idempotent: answering a mutual edge again is the same answer.

import {
  json,
  deriveParticipantRef,
  isOwnerToken,
  isAllowedWriteOrigin,
  type MeetEnv,
} from "../../_meet.ts";

// Lookup shape only — covers device-minted (edge_) AND backfill (r15pair_) ids;
// authority lives in the role check below, not in the id's shape.
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
    // Role guard: only the addressee may answer. A non-participant learns nothing
    // beyond "not yours" (same code as the a-side attempt — no probe surface).
    if (me !== edge.b_ref) return json({ ok: false, error: "not_addressee" }, 403);

    if (edge.state === "mutual") {
      return json({ ok: true, state: "mutual", already: true });
    }
    if (edge.state === "closed") {
      // Honest refusal: a closed room does not reopen (T6) — the UI shows the
      // fact, never a fake success.
      return json({ ok: false, error: "edge_closed" }, 409);
    }
    await env.BOARD
      .prepare(
        "UPDATE r15_edge SET state = 'mutual', last_act_b_at = ?2 " +
          "WHERE edge_id = ?1 AND state = 'sent'",
      )
      .bind(raw.edgeId, new Date().toISOString())
      .run();
    return json({ ok: true, state: "mutual", already: false }, 201);
  } catch {
    return json({ ok: false, error: "talkback_failed" }, 500);
  }
};

export const onRequestOptions: PagesFunction<MeetEnv> = async () =>
  new Response(null, { status: 204, headers: { Allow: "POST, OPTIONS" } });
