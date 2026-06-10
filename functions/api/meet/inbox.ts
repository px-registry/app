// POST /api/meet/inbox — what this owner may see about signals and contact.
//
// POST (not GET) so the owner token travels in the body, never in a URL.
// Returns, for the CALLER only:
//   incoming — signals addressed to me (sender pseudonym, anchor, mutual?)
//   outgoing — refs I have signalled (so the UI shows sent-state)
//   notes    — a peer's contact note ONLY where the signal is MUTUAL (the
//              disclosure rule lives here, in SQL: the join requires both
//              directions to exist before a note row is served)
//   myNotes  — what I have written, so the owner can review/replace it

import {
  json,
  deriveParticipantRef,
  isOwnerToken,
  isAllowedWriteOrigin,
  type MeetEnv,
} from "../../_meet.ts";

interface SignalRow {
  from_ref: string;
  from_name: string;
  anchor: string;
  created_at: string;
  mutual: number;
}
interface OutRow {
  to_ref: string;
  mutual: number;
}
interface NoteRow {
  writer_ref: string;
  note: string;
}
interface MyNoteRow {
  peer_ref: string;
  note: string;
}

export const onRequestPost: PagesFunction<MeetEnv> = async ({ request, env }) => {
  if (!isAllowedWriteOrigin(request)) return json({ ok: false, error: "bad_origin" }, 403);

  const raw = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (raw === null || !isOwnerToken(raw.ownerToken)) return json({ ok: false, error: "token" }, 400);
  const me = await deriveParticipantRef(raw.ownerToken);

  try {
    const incoming = await env.BOARD
      .prepare(
        "SELECT s.from_ref, s.from_name, s.anchor, s.created_at, " +
          "EXISTS(SELECT 1 FROM r15_signal b WHERE b.from_ref = s.to_ref AND b.to_ref = s.from_ref) AS mutual " +
          "FROM r15_signal s WHERE s.to_ref = ?1 ORDER BY s.created_at",
      )
      .bind(me)
      .all<SignalRow>();

    const outgoing = await env.BOARD
      .prepare(
        "SELECT s.to_ref, " +
          "EXISTS(SELECT 1 FROM r15_signal b WHERE b.from_ref = s.to_ref AND b.to_ref = s.from_ref) AS mutual " +
          "FROM r15_signal s WHERE s.from_ref = ?1",
      )
      .bind(me)
      .all<OutRow>();

    // The disclosure rule, in SQL: a peer's note is served ONLY when the
    // mutual signal pair exists.
    const notes = await env.BOARD
      .prepare(
        "SELECT n.writer_ref, n.note FROM r15_contact_note n " +
          "WHERE n.peer_ref = ?1 " +
          "AND EXISTS(SELECT 1 FROM r15_signal a WHERE a.from_ref = ?1 AND a.to_ref = n.writer_ref) " +
          "AND EXISTS(SELECT 1 FROM r15_signal b WHERE b.from_ref = n.writer_ref AND b.to_ref = ?1)",
      )
      .bind(me)
      .all<NoteRow>();

    const myNotes = await env.BOARD
      .prepare("SELECT peer_ref, note FROM r15_contact_note WHERE writer_ref = ?1")
      .bind(me)
      .all<MyNoteRow>();

    return json({
      ok: true,
      incoming: (incoming.results ?? []).map((r) => ({
        fromRef: r.from_ref,
        fromName: r.from_name,
        anchor: r.anchor,
        createdAt: r.created_at,
        mutual: r.mutual === 1,
      })),
      outgoing: (outgoing.results ?? []).map((r) => ({ toRef: r.to_ref, mutual: r.mutual === 1 })),
      notes: (notes.results ?? []).map((r) => ({ fromRef: r.writer_ref, note: r.note })),
      myNotes: (myNotes.results ?? []).map((r) => ({ peerRef: r.peer_ref, note: r.note })),
    });
  } catch {
    return json({ ok: false, error: "inbox_failed" }, 500);
  }
};

export const onRequestOptions: PagesFunction<MeetEnv> = async () =>
  new Response(null, { status: 204, headers: { Allow: "POST, OPTIONS" } });
