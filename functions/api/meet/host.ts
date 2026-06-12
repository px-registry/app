// POST /api/meet/host — the facilitator's read of the test-disclosed lane.
//
// FAIL-CLOSED key gate: FACILITATOR_KEY must be configured as a Pages secret
// AND match (constant-time) — an unconfigured deployment serves nothing.
// POST keeps the key out of URLs/logs. Returns the r15_log rows (proposals +
// readings, per participant, in time order), a signals overview, and the
// candidate pool (fix1: the pool is AI-only for participants; the facilitator
// reading it is part of the IN-APP disclosure — テストの記録のため). Contact
// notes are NOT served here: they belong to the two owners who exchanged them.

import { json, type MeetEnv } from "../../_meet.ts";

interface HostEnv extends MeetEnv {
  FACILITATOR_KEY?: string;
}

function safeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
  return diff === 0;
}

interface LogRow {
  participant_ref: string;
  client_entry_id: string;
  display_name: string;
  question: string;
  proposal_text: string;
  reading: string;
  created_at: string;
  updated_at: string;
}
interface SigRow {
  edge_id: string;
  from_name: string;
  a_ref: string;
  b_ref: string;
  basis_item_ref: string;
  anchor: string;
  state: string;
  created_at: string;
}
interface PoolRow {
  participant_ref: string;
  display_name: string;
  kind: string;
  title: string;
  text: string;
  tags: string;
}

export const onRequestPost: PagesFunction<HostEnv> = async ({ request, env }) => {
  const key = env.FACILITATOR_KEY ?? "";
  const raw = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const given = raw !== null && typeof raw.hostKey === "string" ? raw.hostKey : "";
  // Fail-closed: no configured key → nothing is ever served.
  if (key === "" || !safeEqual(given, key)) return json({ ok: false, error: "host_key" }, 403);

  try {
    const logs = await env.BOARD
      .prepare(
        "SELECT participant_ref, client_entry_id, display_name, question, " +
          "proposal_text, reading, created_at, updated_at " +
          "FROM r15_log ORDER BY display_name, created_at",
      )
      .all<LogRow>();
    // R2 0010: the signals overview is edge rows now (state included — the
    // facilitator sees sent/mutual/closed as facts, never a ranking).
    const signals = await env.BOARD
      .prepare(
        "SELECT edge_id, from_name, a_ref, b_ref, basis_item_ref, anchor, state, created_at " +
          "FROM r15_edge ORDER BY created_at",
      )
      .all<SigRow>();
    const pool = await env.BOARD
      .prepare(
        "SELECT participant_ref, display_name, kind, title, text, tags FROM r15_pool_item " +
          "ORDER BY updated_at, participant_ref, position",
      )
      .all<PoolRow>();
    return json({
      ok: true,
      logs: (logs.results ?? []).map((r) => ({
        participantRef: r.participant_ref,
        entryId: r.client_entry_id,
        displayName: r.display_name,
        question: r.question,
        proposalText: r.proposal_text,
        reading: r.reading,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      })),
      signals: (signals.results ?? []).map((r) => ({
        edgeId: r.edge_id,
        fromName: r.from_name,
        fromRef: r.a_ref,
        toRef: r.b_ref,
        basisItemRef: r.basis_item_ref,
        anchor: r.anchor,
        state: r.state,
        createdAt: r.created_at,
      })),
      pool: (pool.results ?? []).map((r) => {
        let tags: string[] = [];
        try {
          const v = JSON.parse(r.tags);
          tags = Array.isArray(v) ? v.filter((t): t is string => typeof t === "string") : [];
        } catch {
          tags = [];
        }
        return {
          participantRef: r.participant_ref,
          ownerRef: r.display_name,
          kind: r.kind,
          title: r.title,
          text: r.text,
          tags,
        };
      }),
    });
  } catch {
    return json({ ok: false, error: "host_failed" }, 500);
  }
};

export const onRequestOptions: PagesFunction<HostEnv> = async () =>
  new Response(null, { status: 204, headers: { Allow: "POST, OPTIONS" } });
