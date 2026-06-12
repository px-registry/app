// GET /api/meet/pool?me=<participantRef> — the shared candidate pool.
//
// Returns every participant's published items EXCEPT the caller's own
// (self-exclusion server-side; the client re-filters defensively). The SELECT
// lists explicit public columns — there is no owner token column to leak (the
// token is never stored), and no quality sort: rows come back in publish-time
// arrival order (updated_at, then the owner's own input order).

import { json, type MeetEnv } from "../../_meet.ts";
import { isParticipantRef } from "../../../lib/meet-net/ref.ts";

const PUBLIC_COLUMNS = "participant_ref, display_name, intro, kind, title, text, tags, position";

interface RawRow {
  participant_ref: string;
  display_name: string;
  intro: string;
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

/** Day-scoped one-way dedup token — never a stored viewer id (第9便 C). */
async function serveDedup(day: string, viewer: string, owner: string, position: number): Promise<string> {
  const data = new TextEncoder().encode(`r15-serve:${day}:${viewer}:${owner}:${position}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
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
      tags: parseTags(r.tags),
    }));

    // 気配 (第9便 C): a placed question (tag 問い) was just served to another
    // participant's AI — count it once per viewer per day, count only.
    // Best-effort: a counting miss never breaks the pool serve.
    if (exclude !== "") {
      const day = new Date().toISOString().slice(0, 10);
      const stmts = [];
      for (const r of results ?? []) {
        if (!parseTags(r.tags).includes("問い")) continue;
        const dedup = await serveDedup(day, exclude, r.participant_ref, r.position);
        stmts.push(
          env.BOARD
            .prepare(
              "INSERT OR IGNORE INTO r15_question_serve (owner_ref, position, day, dedup) VALUES (?1, ?2, ?3, ?4)",
            )
            .bind(r.participant_ref, r.position, day, dedup),
        );
      }
      if (stmts.length > 0) await env.BOARD.batch(stmts).catch(() => {});
    }

    return json({ ok: true, items });
  } catch {
    return json({ ok: false, error: "pool_failed" }, 500);
  }
};
