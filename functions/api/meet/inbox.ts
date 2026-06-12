// POST /api/meet/inbox — what this owner may see about edges and contact.
//
// POST (not GET) so the owner token travels in the body, never in a URL.
// R2 0010: signals are EDGE rows now. Returns, for the CALLER only:
//   incoming — edges addressed to me (sender pseudonym, anchor, basis, state)
//   outgoing — edges I opened (so the UI shows sent-state PER CARD, not per peer)
//   notes    — a peer's contact note ONLY where a MUTUAL EDGE exists between us
//              (the disclosure rule lives here, in SQL — either orientation;
//              0010 精密化②: 渡せるか＝∃mutual edge, no person-level state table)
//   myNotes  — what I have written, so the owner can review/replace it
//
// Closed edges are served too — the honest fact, shown before pressing (c18b
// lineage); the UI words it, the server never hides it.

import {
  json,
  deriveParticipantRef,
  isOwnerToken,
  isAllowedWriteOrigin,
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
  created_at: string;
}
interface OutEdgeRow {
  edge_id: string;
  b_ref: string;
  basis_item_ref: string;
  state: string;
  created_at: string;
}
interface NoteRow {
  writer_ref: string;
  note: string;
}
interface MyNoteRow {
  peer_ref: string;
  note: string;
}

// ∃ mutual edge between the two refs, either orientation — the ONLY contact
// disclosure predicate (no pair table, no person-level state).
const MUTUAL_EDGE =
  "EXISTS(SELECT 1 FROM r15_edge m WHERE m.state = 'mutual' AND " +
  "((m.a_ref = ?1 AND m.b_ref = n.writer_ref) OR (m.a_ref = n.writer_ref AND m.b_ref = ?1)))";

export const onRequestPost: PagesFunction<MeetEnv> = async ({ request, env }) => {
  if (!isAllowedWriteOrigin(request)) return json({ ok: false, error: "bad_origin" }, 403);

  const raw = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (raw === null || !isOwnerToken(raw.ownerToken)) return json({ ok: false, error: "token" }, 400);
  const me = await deriveParticipantRef(raw.ownerToken);

  try {
    const incoming = await env.BOARD
      .prepare(
        "SELECT e.edge_id, e.a_ref, e.from_name, e.basis_item_ref, e.anchor, e.state, e.created_at, " +
          // sender's CURRENT published ひとこと紹介 (公開射影の一部; '' = unset/departed)
          "COALESCE((SELECT p.intro FROM r15_pool_item p WHERE p.participant_ref = e.a_ref ORDER BY p.position LIMIT 1), '') AS from_intro " +
          "FROM r15_edge e WHERE e.b_ref = ?1 ORDER BY e.created_at",
      )
      .bind(me)
      .all<InEdgeRow>();

    const outgoing = await env.BOARD
      .prepare(
        "SELECT edge_id, b_ref, basis_item_ref, state, created_at " +
          "FROM r15_edge WHERE a_ref = ?1 ORDER BY created_at",
      )
      .bind(me)
      .all<OutEdgeRow>();

    const notes = await env.BOARD
      .prepare(
        `SELECT n.writer_ref, n.note FROM r15_contact_note n WHERE n.peer_ref = ?1 AND ${MUTUAL_EDGE}`,
      )
      .bind(me)
      .all<NoteRow>();

    const myNotes = await env.BOARD
      .prepare("SELECT peer_ref, note FROM r15_contact_note WHERE writer_ref = ?1")
      .bind(me)
      .all<MyNoteRow>();

    // 気配 (第9便 C): today's read-count per OWN placed question — counts only,
    // served back to their owner (a fact, not a score).
    const day = new Date().toISOString().slice(0, 10);
    const reads = await env.BOARD
      .prepare(
        "SELECT position, COUNT(*) AS n FROM r15_question_serve WHERE owner_ref = ?1 AND day = ?2 GROUP BY position",
      )
      .bind(me, day)
      .all<{ position: number; n: number }>();

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
        createdAt: r.created_at,
      })),
      outgoing: (outgoing.results ?? []).map((r) => ({
        edgeId: r.edge_id,
        toRef: r.b_ref,
        basisItemRef: r.basis_item_ref,
        state: r.state,
        createdAt: r.created_at,
      })),
      notes: (notes.results ?? []).map((r) => ({ fromRef: r.writer_ref, note: r.note })),
      myNotes: (myNotes.results ?? []).map((r) => ({ peerRef: r.peer_ref, note: r.note })),
      questionReads: (reads.results ?? []).map((r) => ({ position: r.position, count: r.n })),
    });
  } catch {
    return json({ ok: false, error: "inbox_failed" }, 500);
  }
};

export const onRequestOptions: PagesFunction<MeetEnv> = async () =>
  new Response(null, { status: 204, headers: { Allow: "POST, OPTIONS" } });
