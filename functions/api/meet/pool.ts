// GET /api/meet/pool?me=<participantRef> — the shared candidate pool.
//
// Returns every participant's published items EXCEPT the caller's own
// (self-exclusion server-side; the client re-filters defensively). The SELECT
// lists explicit public columns — there is no owner token column to leak (the
// token is never stored), and no quality sort: rows come back in publish-time
// arrival order (updated_at, then the owner's own input order).

import { json, parseTagsJson, recordQuestionServes, type MeetEnv } from "../../_meet.ts";
import { isParticipantRef } from "../../../lib/meet-net/ref.ts";

const PUBLIC_COLUMNS = "participant_ref, display_name, intro, kind, title, text, tags, position, item_ref, business";

interface RawRow {
  participant_ref: string;
  display_name: string;
  intro: string;
  kind: string;
  title: string;
  text: string;
  tags: string;
  position: number;
  item_ref: string;
  business: number;
}

export const onRequestGet: PagesFunction<MeetEnv> = async ({ request, env }) => {
  const url = new URL(request.url);
  const me = url.searchParams.get("me") ?? "";
  const exclude = isParticipantRef(me) ? me : "";

  try {
    const { results } = await env.BOARD
      .prepare(
        `SELECT ${PUBLIC_COLUMNS} FROM r15_pool_item ` +
          "WHERE participant_ref <> ?1 ORDER BY updated_at, participant_ref, position",
      )
      .bind(exclude)
      .all<RawRow>();
    const items = (results ?? []).map((r) => ({
      participantRef: r.participant_ref,
      ownerRef: r.display_name,
      ownerIntro: r.intro,
      kind: r.kind,
      title: r.title,
      text: r.text,
      tags: parseTagsJson(r.tags),
      // R2 0010: the item's stable public alias — what an edge's basis_item_ref
      // points at. Device-minted; never a raw internal id (invariant 5).
      itemRef: r.item_ref,
      // R2 0012: ビジネス旗 — owner の自己申告を素通し（判定・絞込に使わない）。
      business: r.business === 1,
    }));

    // 気配 (第9便 C): a placed question (tag 問い) was just served to another
    // participant's AI — count it once per viewer per day, count only.
    // Best-effort: a counting miss never breaks the pool serve（共有形は _meet.ts）.
    if (exclude !== "") {
      await recordQuestionServes(env, exclude, results ?? []);
    }

    return json({ ok: true, items });
  } catch {
    return json({ ok: false, error: "pool_failed" }, 500);
  }
};
