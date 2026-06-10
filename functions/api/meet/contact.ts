// POST /api/meet/contact — leave (or replace) my contact note for ONE peer.
//
// The note is the owner's own words (how to reach me), addressed to exactly
// one peer, and the server REFUSES to hold it unless the 話してみる signal is
// already MUTUAL between the two — before that moment PX does not custody
// contact information at all. Disclosure back out is inbox.ts's mutual-join.
// Names/contact never appear in the pool or the signal itself.

import {
  json,
  deriveParticipantRef,
  isOwnerToken,
  isParticipantRef,
  isAllowedWriteOrigin,
  MAX_NOTE,
  type MeetEnv,
} from "../../_meet.ts";

export const onRequestPost: PagesFunction<MeetEnv> = async ({ request, env }) => {
  if (!isAllowedWriteOrigin(request)) return json({ ok: false, error: "bad_origin" }, 403);

  const raw = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (raw === null || !isOwnerToken(raw.ownerToken)) return json({ ok: false, error: "token" }, 400);
  if (!isParticipantRef(raw.peerRef)) return json({ ok: false, error: "peer_ref" }, 400);
  const note = typeof raw.note === "string" ? raw.note.trim() : "";
  if (note.length === 0 || note.length > MAX_NOTE) return json({ ok: false, error: "note" }, 400);

  const me = await deriveParticipantRef(raw.ownerToken);
  if (me === raw.peerRef) return json({ ok: false, error: "self" }, 400);

  try {
    // Mutual-only custody: refuse to store before both signals exist.
    const mutual = await env.BOARD
      .prepare(
        "SELECT " +
          "EXISTS(SELECT 1 FROM r15_signal a WHERE a.from_ref = ?1 AND a.to_ref = ?2) AND " +
          "EXISTS(SELECT 1 FROM r15_signal b WHERE b.from_ref = ?2 AND b.to_ref = ?1) AS m",
      )
      .bind(me, raw.peerRef)
      .all<{ m: number }>();
    if ((mutual.results?.[0]?.m ?? 0) !== 1) {
      return json({ ok: false, error: "not_mutual" }, 403);
    }

    await env.BOARD
      .prepare(
        "INSERT INTO r15_contact_note (writer_ref, peer_ref, note, created_at) " +
          "VALUES (?1, ?2, ?3, ?4) " +
          "ON CONFLICT (writer_ref, peer_ref) DO UPDATE SET note = ?3",
      )
      .bind(me, raw.peerRef, note, new Date().toISOString())
      .run();
    return json({ ok: true }, 201);
  } catch {
    return json({ ok: false, error: "contact_failed" }, 500);
  }
};

export const onRequestOptions: PagesFunction<MeetEnv> = async () =>
  new Response(null, { status: 204, headers: { Allow: "POST, OPTIONS" } });
