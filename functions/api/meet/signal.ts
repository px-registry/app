// POST /api/meet/signal — T1: open an edge (∅→sent) for one 話してみる.
//
// R2 0010 (docs/r2/0010-edge-and-item-ref.md): the signal is EDGE-scoped —
// proposal's basis item (basis_item_ref) + the two participants. The sender's
// identity is the derived ref (token dropped, as everywhere). No notification
// machinery: the receiver sees it on their next visit.
//
// T1 guards live in performT1 (functions/_meet.ts) — shared with the chat port
// so the page and the port walk the SAME transition table (0010 が正本のまま):
//   * b must be in the pool NOW, and the basis item must be b's published item.
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
  performT1,
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
  // 0011: the addressee's public pseudonym AT SEND TIME (same data class as
  // from_name) — a's pair face keeps the name even if b later leaves the pool.
  const toName = typeof raw.toName === "string" ? raw.toName.trim().slice(0, MAX_NAME) : "";
  const anchor =
    typeof raw.anchor === "string" ? raw.anchor.trim().slice(0, MAX_ANCHOR) : "";
  // Opaque pointer into the sender's own device shelf (recv entry+card) — no
  // proposal text ever crosses; shape-capped and stored verbatim.
  const proposalPtr =
    typeof raw.proposalPtr === "string" ? raw.proposalPtr.trim().slice(0, MAX_PROPOSAL_PTR) : "";

  const fromRef = await deriveParticipantRef(raw.ownerToken);
  if (fromRef === raw.toRef) return json({ ok: false, error: "self_signal" }, 400);

  const t1 = await performT1(env, {
    fromRef,
    toRef: raw.toRef,
    edgeId: raw.edgeId,
    basisItemRef: raw.basisItemRef,
    fromName,
    toName,
    anchor,
    proposalPtr,
  });
  if (!t1.ok) {
    const status = t1.error === "signal_failed" ? 500 : 404;
    return json({ ok: false, error: t1.error }, status);
  }
  return json(
    { ok: true, edgeId: t1.edgeId, state: t1.state, existing: t1.existing },
    t1.existing ? 200 : 201,
  );
};

export const onRequestOptions: PagesFunction<MeetEnv> = async () =>
  new Response(null, { status: 204, headers: { Allow: "POST, OPTIONS" } });
