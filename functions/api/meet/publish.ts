// POST /api/meet/publish — replace this owner's public projection.
//
// The owner's device sends { ownerToken, displayName, items } where items have
// ALREADY passed the frozen rig-core gate (buildPublicPool, fail-closed) on the
// device. This Function re-validates fail-closed (shape, caps, and the
// private/ownerId tripwire), derives the opaque participant_ref from the token,
// DROPS the token, and replaces the owner's rows atomically (delete + insert in
// one batch). Publishing again replaces — unpublishing everything is publishing
// an empty list.
//
// POST only; same-origin guarded. No score, no rank, no auto-publish: every row
// here exists because the owner pressed 公開する.

import {
  json,
  validatePublish,
  deriveParticipantRef,
  isAllowedWriteOrigin,
  type MeetEnv,
} from "../../_meet.ts";

export const onRequestPost: PagesFunction<MeetEnv> = async ({ request, env }) => {
  if (!isAllowedWriteOrigin(request)) {
    return json({ ok: false, error: "bad_origin" }, 403);
  }

  const raw = await request.json().catch(() => null);
  const v = validatePublish(raw);
  if (!v.ok) return json({ ok: false, error: "invalid_publish", reason: v.reason }, 400);

  const ref = await deriveParticipantRef(v.value.ownerToken);
  const at = new Date().toISOString();

  try {
    const stmts = [
      env.BOARD.prepare("DELETE FROM r15_pool_item WHERE participant_ref = ?1").bind(ref),
      ...v.value.items.map((it) =>
        env.BOARD
          .prepare(
            "INSERT INTO r15_pool_item " +
              "(participant_ref, display_name, intro, kind, title, text, tags, position, updated_at) " +
              "VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
          )
          .bind(ref, v.value.displayName, v.value.intro, it.kind, it.title, it.text, JSON.stringify(it.tags), it.position, at),
      ),
    ];
    await env.BOARD.batch(stmts);
    return json({ ok: true, count: v.value.items.length, participantRef: ref }, 201);
  } catch {
    // Fail closed: never leak an internal error body.
    return json({ ok: false, error: "publish_failed" }, 500);
  }
};

export const onRequestOptions: PagesFunction<MeetEnv> = async () =>
  new Response(null, { status: 204, headers: { Allow: "POST, OPTIONS" } });
