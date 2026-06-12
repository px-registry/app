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
// R2 0010: every item carries its device-minted stable alias (item_ref). The
// gated SEMANTICS — alias continuity across republish, so edges' basis_item_ref
// stays resolvable — is carried by the DEVICE resending the same alias, not by
// physical row survival. Atomic replace is kept on purpose: a true (ref,item_ref)
// upsert would fight the legacy (ref,position) PRIMARY KEY when items reorder
// (transient PK collisions inside the batch). Edges reference item_ref VALUES,
// never rowids, so replace-with-stable-aliases is observably identical.
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
      // R2 0013: 公開鍵の upsert（公開物・プール離脱でも残る別テーブル）。鍵が
      // 変わったときだけ gen を繰り上げ — 受け手の「鍵が変わりました」事実表示用。
      ...(v.value.encPub !== ""
        ? [
            env.BOARD
              .prepare(
                "INSERT INTO r15_enc_key (participant_ref, enc_pub, gen, updated_at) " +
                  "VALUES (?1, ?2, 1, ?3) " +
                  "ON CONFLICT (participant_ref) DO UPDATE SET " +
                  "gen = gen + (CASE WHEN r15_enc_key.enc_pub != excluded.enc_pub THEN 1 ELSE 0 END), " +
                  "enc_pub = excluded.enc_pub, updated_at = excluded.updated_at",
              )
              .bind(ref, v.value.encPub, at),
          ]
        : []),
      ...v.value.items.map((it) =>
        env.BOARD
          .prepare(
            "INSERT INTO r15_pool_item " +
              "(participant_ref, display_name, intro, kind, title, text, tags, position, updated_at, item_ref, business) " +
              "VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
          )
          .bind(ref, v.value.displayName, v.value.intro, it.kind, it.title, it.text, JSON.stringify(it.tags), it.position, at, it.itemRef, it.business ? 1 : 0),
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
