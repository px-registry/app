// POST /api/meet/signal — T1: open an edge (∅→sent) for one 話してみる.
//
// R2 0010 (docs/r2/0010-edge-and-item-ref.md): the signal is EDGE-scoped —
// proposal's basis item (basis_item_ref) + the two participants. The sender's
// identity is the derived ref (token dropped, as everywhere). No notification
// machinery: the receiver sees it on their next visit.
//
// T1 guards (the gate's transition table is the authority):
//   * b must be in the pool NOW, and the basis item must be b's published item
//     (act-time validation only — existing edges stay reachable; that is the
//     pool-departure / reachability separation, c18 lifted to its final form).
//   * One live edge per (a, b, basis) triple: pressing again returns the
//     EXISTING edge honestly (押すことは一度押したこと) — never a duplicate room.
//   * edge_id is device-minted with the edge_ prefix; the r15pair_ namespace is
//     reserved for backfill provenance and rejected here BY SHAPE (gate cond. 2).
//   * mutual is NEVER written here — two opposite sents are two edges, not a
//     mutual (0010 精密化①). T2 (talkback) is the only mutual writer.

import {
  json,
  deriveParticipantRef,
  isOwnerToken,
  isParticipantRef,
  isItemRef,
  isClientEdgeId,
  isAllowedWriteOrigin,
  MAX_ANCHOR,
  MAX_NAME,
  type MeetEnv,
} from "../../_meet.ts";

const MAX_PROPOSAL_PTR = 80;

export const onRequestPost: PagesFunction<MeetEnv> = async ({ request, env }) => {
  if (!isAllowedWriteOrigin(request)) return json({ ok: false, error: "bad_origin" }, 403);

  const raw = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (raw === null || typeof raw !== "object") return json({ ok: false, error: "body" }, 400);
  if (!isOwnerToken(raw.ownerToken)) return json({ ok: false, error: "token" }, 400);
  if (!isParticipantRef(raw.toRef)) return json({ ok: false, error: "to_ref" }, 400);
  if (!isClientEdgeId(raw.edgeId)) return json({ ok: false, error: "edge_id" }, 400);
  if (!isItemRef(raw.basisItemRef)) return json({ ok: false, error: "basis_item_ref" }, 400);
  const fromName = typeof raw.fromName === "string" ? raw.fromName.trim() : "";
  if (fromName.length === 0 || fromName.length > MAX_NAME) {
    return json({ ok: false, error: "from_name" }, 400);
  }
  const anchor =
    typeof raw.anchor === "string" ? raw.anchor.trim().slice(0, MAX_ANCHOR) : "";
  // Opaque pointer into the sender's own device shelf (recv entry+card) — no
  // proposal text ever crosses; shape-capped and stored verbatim.
  const proposalPtr =
    typeof raw.proposalPtr === "string" ? raw.proposalPtr.trim().slice(0, MAX_PROPOSAL_PTR) : "";

  const fromRef = await deriveParticipantRef(raw.ownerToken);
  if (fromRef === raw.toRef) return json({ ok: false, error: "self_signal" }, 400);

  try {
    // T1 guard: the addressee must be in the pool NOW and the basis item must be
    // THEIR published item. Distinct honest codes: peer gone vs item withdrawn.
    const present = await env.BOARD
      .prepare("SELECT 1 AS x FROM r15_pool_item WHERE participant_ref = ?1 LIMIT 1")
      .bind(raw.toRef)
      .all();
    if ((present.results ?? []).length === 0) {
      return json({ ok: false, error: "peer_not_in_pool" }, 404);
    }
    const basis = await env.BOARD
      .prepare(
        "SELECT 1 AS x FROM r15_pool_item WHERE participant_ref = ?1 AND item_ref = ?2 LIMIT 1",
      )
      .bind(raw.toRef, raw.basisItemRef)
      .all();
    if ((basis.results ?? []).length === 0) {
      return json({ ok: false, error: "basis_not_in_pool" }, 404);
    }

    // Live-triple idempotency (gate condition 1): an existing live edge on the
    // same (a, b, basis) is returned as-is — no second room, no state change.
    const live = await env.BOARD
      .prepare(
        "SELECT edge_id, state FROM r15_edge " +
          "WHERE a_ref = ?1 AND b_ref = ?2 AND basis_item_ref = ?3 AND state != 'closed' LIMIT 1",
      )
      .bind(fromRef, raw.toRef, raw.basisItemRef)
      .all<{ edge_id: string; state: string }>();
    const existing = (live.results ?? [])[0];
    if (existing !== undefined) {
      return json({ ok: true, edgeId: existing.edge_id, state: existing.state, existing: true });
    }

    const now = new Date().toISOString();
    await env.BOARD
      .prepare(
        "INSERT INTO r15_edge " +
          "(edge_id, a_ref, b_ref, basis_item_ref, proposal_ptr, anchor, from_name, state, created_at, last_act_a_at) " +
          "VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'sent', ?8, ?8)",
      )
      .bind(raw.edgeId, fromRef, raw.toRef, raw.basisItemRef, proposalPtr, anchor, fromName, now)
      .run();
    return json({ ok: true, edgeId: raw.edgeId, state: "sent", existing: false }, 201);
  } catch {
    // Includes the UNIQUE live-triple race: two concurrent presses — re-read and
    // answer honestly with whichever edge won.
    try {
      const after = await env.BOARD
        .prepare(
          "SELECT edge_id, state FROM r15_edge " +
            "WHERE a_ref = ?1 AND b_ref = ?2 AND basis_item_ref = ?3 AND state != 'closed' LIMIT 1",
        )
        .bind(fromRef, raw.toRef, raw.basisItemRef)
        .all<{ edge_id: string; state: string }>();
      const won = (after.results ?? [])[0];
      if (won !== undefined) {
        return json({ ok: true, edgeId: won.edge_id, state: won.state, existing: true });
      }
    } catch {
      // fall through to the honest failure below
    }
    return json({ ok: false, error: "signal_failed" }, 500);
  }
};

export const onRequestOptions: PagesFunction<MeetEnv> = async () =>
  new Response(null, { status: 204, headers: { Allow: "POST, OPTIONS" } });
