// GET /api/meet/pool?me=<participantRef> — the shared candidate pool.
//
// Returns every participant's published items EXCEPT the caller's own
// (self-exclusion server-side; the client re-filters defensively). The SELECT
// lists explicit public columns — there is no owner token column to leak (the
// token is never stored), and no quality sort: rows come back in publish-time
// arrival order (updated_at, then the owner's own input order).

import { json, type MeetEnv } from "../../_meet.ts";
import { isParticipantRef } from "../../../lib/meet-net/ref.ts";

const PUBLIC_COLUMNS = "participant_ref, display_name, kind, title, text, tags, position";

interface RawRow {
  participant_ref: string;
  display_name: string;
  kind: string;
  title: string;
  text: string;
  tags: string;
  position: number;
}

function parseTags(s: string): string[] {
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v.filter((t): t is string => typeof t === "string") : [];
  } catch {
    return [];
  }
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
      kind: r.kind,
      title: r.title,
      text: r.text,
      tags: parseTags(r.tags),
    }));
    return json({ ok: true, items });
  } catch {
    return json({ ok: false, error: "pool_failed" }, 500);
  }
};
