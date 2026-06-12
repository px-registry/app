// POST /api/meet/log — the test-disclosed facilitator lane.
//
// One row per received generation (keyed by the owner-local entry id), holding
// the proposal text as received + the owner's reading. The five testers are
// told, in the app itself, that the facilitator reads this during the test —
// it exists ONLY because of that disclosure. It is not a board, not a feed,
// not visible to other participants; the only read path is the
// facilitator-key-gated host endpoint.

import {
  json,
  deriveParticipantRef,
  isOwnerToken,
  isAllowedWriteOrigin,
  MAX_NAME,
  MAX_QUESTION,
  MAX_PROPOSAL,
  MAX_READING,
  type MeetEnv,
} from "../../_meet.ts";

export const onRequestPost: PagesFunction<MeetEnv> = async ({ request, env }) => {
  if (!isAllowedWriteOrigin(request)) return json({ ok: false, error: "bad_origin" }, 403);

  const raw = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (raw === null || !isOwnerToken(raw.ownerToken)) return json({ ok: false, error: "token" }, 400);
  const clientEntryId = typeof raw.clientEntryId === "string" ? raw.clientEntryId.trim() : "";
  if (clientEntryId === "" || clientEntryId.length > 64) {
    return json({ ok: false, error: "entry_id" }, 400);
  }
  const displayName = typeof raw.displayName === "string" ? raw.displayName.trim() : "";
  if (displayName.length === 0 || displayName.length > MAX_NAME) {
    return json({ ok: false, error: "display_name" }, 400);
  }
  const question = typeof raw.question === "string" ? raw.question.slice(0, MAX_QUESTION) : "";
  const proposalText =
    typeof raw.proposalText === "string" ? raw.proposalText.slice(0, MAX_PROPOSAL) : "";
  if (proposalText.trim() === "") return json({ ok: false, error: "proposal" }, 400);
  const reading = typeof raw.reading === "string" ? raw.reading.slice(0, MAX_READING) : "";

  const ref = await deriveParticipantRef(raw.ownerToken);
  const at = new Date().toISOString();

  try {
    await env.BOARD
      .prepare(
        "INSERT INTO r15_log " +
          "(participant_ref, client_entry_id, display_name, question, proposal_text, reading, created_at, updated_at) " +
          "VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7) " +
          "ON CONFLICT (participant_ref, client_entry_id) DO UPDATE SET " +
          "display_name = ?3, question = ?4, proposal_text = ?5, reading = ?6, updated_at = ?7",
      )
      .bind(ref, clientEntryId, displayName, question, proposalText, reading, at)
      .run();
    return json({ ok: true }, 201);
  } catch {
    return json({ ok: false, error: "log_failed" }, 500);
  }
};

export const onRequestOptions: PagesFunction<MeetEnv> = async () =>
  new Response(null, { status: 204, headers: { Allow: "POST, OPTIONS" } });
