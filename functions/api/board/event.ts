// POST /api/board/event
//
// The owner-authenticated write surface for the record chain. The owner appends
// EVENT MATERIAL about their own listing: a contact fact, a handoff draft (an
// owner-controlled external URL), or an owner declaration (which mints a
// public-safe declaration id, records the two chain events, and appends the id to
// the listing's receiptRefs).
//
// Boundary enforced here:
//   * Auth + ownership: only the listing's owner can write to its chain.
//   * No body/PII is ever accepted or stored — the request carries a kind, and at
//     most an owner-controlled URL or a declaration kind. There is no message,
//     email, phone, or counterparty field.
//   * PX executes no payment/escrow/settlement — a declaration is the owner's
//     statement that something took place, not a PX verdict.

import {
  appendContactOpened,
  appendHandoffDraft,
  createDeclaration,
  getListingOwner,
  TRANSACTION_BOUNDARY,
  type BoardDbEnv,
} from "../../_transaction.ts";
import { isDeclarationKind, type DeclarationKindV1 } from "../../../lib/board/index.ts";
import { readSession, type AuthEnv } from "../../_auth.ts";

type Env = BoardDbEnv & AuthEnv;

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });

// The kinds an owner may author directly. receipt_ref_attached is system-only
// (emitted inside createDeclaration), so it is deliberately not accepted here.
const AUTHORABLE = new Set(["contact_opened", "handoff_draft_created", "owner_declaration_created"]);

interface EventBody {
  recordId?: unknown;
  kind?: unknown;
  actionUrl?: unknown;
  declarationKind?: unknown;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const session = await readSession(env, request);
  if (!session) return json({ ok: false, error: "Not signed in." }, 401);

  const body = (await request.json().catch(() => ({}))) as EventBody;
  const recordId = typeof body.recordId === "string" ? body.recordId : "";
  const kind = typeof body.kind === "string" ? body.kind : "";
  if (!recordId || !AUTHORABLE.has(kind)) {
    return json({ ok: false, error: "recordId and a valid kind are required." }, 400);
  }

  // Ownership: only the listing's owner may write to its chain.
  const owner = await getListingOwner(env.BOARD, recordId);
  if (!owner) return json({ ok: false, error: "Listing not found." }, 404);
  if (owner.ownerHandle !== session.handle) {
    return json({ ok: false, error: "Not your listing." }, 403);
  }

  const at = new Date().toISOString();
  try {
    if (kind === "contact_opened") {
      const event = await appendContactOpened(env.BOARD, recordId, at);
      return json({ ok: true, event, machineReadableBoundary: TRANSACTION_BOUNDARY });
    }
    if (kind === "handoff_draft_created") {
      if (typeof body.actionUrl !== "string") {
        return json({ ok: false, error: "actionUrl required for a handoff draft." }, 400);
      }
      const event = await appendHandoffDraft(env.BOARD, recordId, body.actionUrl, at);
      return json({ ok: true, event, machineReadableBoundary: TRANSACTION_BOUNDARY });
    }
    // owner_declaration_created
    if (!isDeclarationKind(body.declarationKind)) {
      return json({ ok: false, error: "declarationKind must be handoff or exchange." }, 400);
    }
    const declaration = await createDeclaration(env.BOARD, {
      recordId,
      ownerHandle: owner.ownerHandle,
      ownerPublicRef: owner.ownerPublicRef,
      kind: body.declarationKind as DeclarationKindV1,
      at,
    });
    return json({ ok: true, declaration, machineReadableBoundary: TRANSACTION_BOUNDARY });
  } catch {
    // Fail closed: a bad URL, a non-public-safe ref, or a DB error yields a clean
    // 400 with no internal detail.
    return json({ ok: false, error: "Could not record the event." }, 400);
  }
};

export const onRequestOptions: PagesFunction<Env> = async () =>
  new Response(null, { status: 204, headers: CORS });
