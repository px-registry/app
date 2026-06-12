// GET /api/meet/enckey?ref=<participantRef> — a participant's E2EE public key.
//
// R2 0013: public material (the same standing as the published projection),
// served even after the participant leaves the pool — reachability separation
// applies to keys too (an existing mutual edge must stay encryptable). The
// private key never exists server-side; gen is the honest "鍵が変わりました"
// fact counter (no judgment, no history of old keys).

import { json, type MeetEnv } from "../../_meet.ts";
import { isParticipantRef } from "../../../lib/meet-net/ref.ts";

export const onRequestGet: PagesFunction<MeetEnv> = async ({ request, env }) => {
  const url = new URL(request.url);
  const ref = url.searchParams.get("ref") ?? "";
  if (!isParticipantRef(ref)) return json({ ok: false, error: "ref" }, 400);

  try {
    const found = await env.BOARD
      .prepare("SELECT enc_pub, gen FROM r15_enc_key WHERE participant_ref = ?1")
      .bind(ref)
      .all<{ enc_pub: string; gen: number }>();
    const row = (found.results ?? [])[0];
    if (row === undefined) return json({ ok: false, error: "no_key" }, 404);
    return json({ ok: true, encPub: row.enc_pub, gen: row.gen });
  } catch {
    return json({ ok: false, error: "enckey_failed" }, 500);
  }
};
