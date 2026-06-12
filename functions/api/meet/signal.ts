// POST /api/meet/signal — send (or re-send) the one-sided 話してみる signal.
//
// The sender's identity is the derived ref (token dropped, as everywhere).
// The receiver will see: who (public pseudonym), one short anchor line, when.
// Idempotent upsert on (from_ref, to_ref) — pressing twice is pressing once.
// A signal to yourself, or to a ref shape that isn't one, is refused. No
// notification machinery: the receiver sees it on their next visit (R1.5).
//
// c18: a signal to a peer with NO pool presence is refused with a machine-
// readable code (peer_not_in_pool) — 取り下げ済みの相手への合図がサーバで
// 受理されて偽の成功になっていた（Hiroto 実測 2026-06-12）。行為時検証のみ:
// existing signal rows stay (歴史は事実), only the new act is stopped.

import {
  json,
  deriveParticipantRef,
  isOwnerToken,
  isParticipantRef,
  isAllowedWriteOrigin,
  MAX_ANCHOR,
  MAX_NAME,
  type MeetEnv,
} from "../../_meet.ts";

export const onRequestPost: PagesFunction<MeetEnv> = async ({ request, env }) => {
  if (!isAllowedWriteOrigin(request)) return json({ ok: false, error: "bad_origin" }, 403);

  const raw = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (raw === null || typeof raw !== "object") return json({ ok: false, error: "body" }, 400);
  if (!isOwnerToken(raw.ownerToken)) return json({ ok: false, error: "token" }, 400);
  if (!isParticipantRef(raw.toRef)) return json({ ok: false, error: "to_ref" }, 400);
  const fromName = typeof raw.fromName === "string" ? raw.fromName.trim() : "";
  if (fromName.length === 0 || fromName.length > MAX_NAME) {
    return json({ ok: false, error: "from_name" }, 400);
  }
  const anchor =
    typeof raw.anchor === "string" ? raw.anchor.trim().slice(0, MAX_ANCHOR) : "";

  const fromRef = await deriveParticipantRef(raw.ownerToken);
  if (fromRef === raw.toRef) return json({ ok: false, error: "self_signal" }, 400);

  try {
    // c18: the addressee must be in the pool NOW (any row). A withdrawn or
    // never-published ref is an honest refusal, not a stored signal.
    const present = await env.BOARD
      .prepare("SELECT 1 AS x FROM r15_pool_item WHERE participant_ref = ?1 LIMIT 1")
      .bind(raw.toRef)
      .all();
    if ((present.results ?? []).length === 0) {
      return json({ ok: false, error: "peer_not_in_pool" }, 404);
    }
    await env.BOARD
      .prepare(
        "INSERT INTO r15_signal (from_ref, to_ref, from_name, anchor, created_at) " +
          "VALUES (?1, ?2, ?3, ?4, ?5) " +
          "ON CONFLICT (from_ref, to_ref) DO UPDATE SET from_name = ?3, anchor = ?4",
      )
      .bind(fromRef, raw.toRef, fromName, anchor, new Date().toISOString())
      .run();
    // mutual? — tell the sender so the UI can open the contact step right away
    const back = await env.BOARD
      .prepare("SELECT 1 AS x FROM r15_signal WHERE from_ref = ?1 AND to_ref = ?2")
      .bind(raw.toRef, fromRef)
      .all();
    const mutual = (back.results ?? []).length > 0;
    return json({ ok: true, mutual }, 201);
  } catch {
    return json({ ok: false, error: "signal_failed" }, 500);
  }
};

export const onRequestOptions: PagesFunction<MeetEnv> = async () =>
  new Response(null, { status: 204, headers: { Allow: "POST, OPTIONS" } });
