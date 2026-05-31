// POST /api/owner/board/unpublish
//
// The owner's takedown / kill-switch for a published row. A signed-in owner
// retires one of THEIR OWN rows by record_id — publication_state flips to
// 'retired' and the row disappears from every public read (/search, /board,
// /proposals) while staying in D1 (the owner can re-publish later as a fresh row).
//
// Security surface (req 11 / 12):
//   * Origin/CSRF guard + signed session (same as publish).
//   * Ownership check — the row's PRIVATE owner_handle must equal the session
//     handle. Owner A can never retire owner B's row (403). The handle is read
//     for the check only and never returned.
//   * record_id from the body is the TARGET of the retire, never an identity — it
//     selects an existing row; it cannot mint or overwrite one.
//
// POST only — no GET mutation.

import { readSession, json, type AuthEnv } from "../../../_auth.ts";
import {
  isAllowedWriteOrigin,
  getRowOwnerHandle,
  retireRow,
  type BoardWriteEnv,
} from "../../../_ownerboard.ts";

type Env = AuthEnv & BoardWriteEnv;

interface UnpublishBody {
  recordId?: unknown;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!isAllowedWriteOrigin(request)) {
    return json({ ok: false, error: "bad_origin" }, 403);
  }

  const session = await readSession(env, request);
  if (!session) return json({ ok: false, error: "not_signed_in" }, 401);

  const body = (await request.json().catch(() => ({}))) as UnpublishBody;
  const recordId = typeof body.recordId === "string" ? body.recordId : "";
  if (!recordId) return json({ ok: false, error: "recordId required" }, 400);

  // Ownership: only the row's owner may retire it.
  const ownerHandle = await getRowOwnerHandle(env.BOARD, recordId);
  if (!ownerHandle) return json({ ok: false, error: "not_found" }, 404);
  if (ownerHandle !== session.handle) return json({ ok: false, error: "not_your_row" }, 403);

  try {
    await retireRow(env.BOARD, recordId, new Date().toISOString());
    return json({ ok: true, recordId, publicationState: "retired" });
  } catch {
    return json({ ok: false, error: "unpublish_failed" }, 500);
  }
};

export const onRequestOptions: PagesFunction<Env> = async () =>
  new Response(null, { status: 204, headers: { Allow: "POST, OPTIONS" } });
