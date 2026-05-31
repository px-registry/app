// POST /api/owner/board/publish
//
// The first owner-WRITE lane (A1 had a read surface only). A signed-in owner
// publishes their own owner-local draft board to the public board: each canonical
// row becomes a public board_records row under the owner's server-derived public
// ref, with a server-minted record_id and publication_state = 'public'.
//
// Security surface locked here (the whole point of this minimal first write):
//   * Origin/CSRF guard — a cookie write must come from one of our own origins.
//   * Signed session     — owner identity is the session handle, never the body.
//   * Body allowlist     — only boardTitle + canonical rows + a contact readiness
//                          are read; owner_handle / owner_public_ref / record_id /
//                          credential in the body are ignored (req 1 / 2 / 18).
//   * Server-minted id   — record_id is minted here; a body id never overwrites a row.
//   * Structural minimum — title + ≥1 row + contact, re-checked server-side; PX
//                          judges no content and never auto-publishes.
//   * Payload caps       — oversized payloads reject before any DB write.
//
// POST only — there is no GET handler, so no mutation can ride a GET (req 11).

import { readSession, getOwner, json, type AuthEnv } from "../../../_auth.ts";
import { validatePublishInput } from "../../../../lib/board/index.ts";
import {
  isAllowedWriteOrigin,
  deriveOwnerPublicRef,
  insertPublishedBoard,
  type BoardWriteEnv,
} from "../../../_ownerboard.ts";

type Env = AuthEnv & BoardWriteEnv;

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  // 1. CSRF/Origin guard — fail-closed before anything else is read.
  if (!isAllowedWriteOrigin(request)) {
    return json({ ok: false, error: "bad_origin" }, 403);
  }

  // 2. Signed session — owner identity comes from here, never the body.
  const session = await readSession(env, request);
  if (!session) return json({ ok: false, error: "not_signed_in" }, 401);

  // 3. Body allowlist + canonical + caps + structural minimum (pure, fail-closed).
  const raw = await request.json().catch(() => null);
  const v = validatePublishInput(raw);
  if (!v.ok) return json({ ok: false, error: "invalid_publish", reason: v.reason }, 400);

  // 4. Derive the PUBLIC owner ref server-side (req 18) — never from the body.
  let ownerPublicRef: string;
  try {
    ownerPublicRef = deriveOwnerPublicRef(await getOwner(env, session.handle), session.handle);
  } catch {
    return json({ ok: false, error: "owner_ref_unavailable" }, 400);
  }

  // 5. Insert with server-minted ids, publication_state = 'public'.
  try {
    const records = await insertPublishedBoard(env.BOARD, {
      ownerHandle: session.handle,
      ownerPublicRef,
      rows: v.rows,
      at: new Date().toISOString(),
    });
    return json({ ok: true, count: records.length, records }, 201);
  } catch {
    // Fail closed: never leak an internal error body.
    return json({ ok: false, error: "publish_failed" }, 500);
  }
};

export const onRequestOptions: PagesFunction<Env> = async () =>
  new Response(null, { status: 204, headers: { Allow: "POST, OPTIONS" } });
