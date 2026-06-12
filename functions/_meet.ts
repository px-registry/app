// Shared helpers for the R1.5 meet Functions. Leading underscore = not routed.
//
// Constitution, enforced here:
//   * The server holds ONLY: the public projection (owner-published items),
//     the 話してみる signal, the mutual-only contact note, and the
//     test-disclosed facilitator log. No private memory — a publish payload
//     carrying a `private` or `ownerId`/`items.private` key is REJECTED whole
//     (defense against an upstream bug posting full memory).
//   * The owner's secret token is derived to an opaque participant_ref and
//     DROPPED — never stored, never logged, never echoed.
//   * No score/rank column, no quality sort — reads return arrival order.
//
// Imports are relative into the top-level lib/ (the Pages build bundles with
// esbuild, no "@/*" alias) — same convention as functions/_board.ts.

import { deriveParticipantRef, isOwnerToken, isParticipantRef } from "../lib/meet-net/ref.ts";

export interface MeetEnv {
  /** Same D1 database as the board (wrangler.toml binding = "BOARD");
   *  the r15_* tables live alongside it (migrations/0007). */
  BOARD: D1Database;
}

export { deriveParticipantRef, isOwnerToken, isParticipantRef };

export const MEET_KINDS = new Set(["have", "want", "avoid", "memory"]);

// Payload caps — reject before any DB write.
export const MAX_ITEMS = 60;
export const MAX_TITLE = 120;
export const MAX_TEXT = 600;
export const MAX_TAGS = 6;
export const MAX_TAG = 30;
export const MAX_NAME = 30;
export const MAX_INTRO = 80;
export const MAX_ANCHOR = 80;
export const MAX_NOTE = 500;
export const MAX_QUESTION = 300;
export const MAX_PROPOSAL = 8000;
export const MAX_READING = 4000;

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export type CleanPublish = {
  ownerToken: string;
  displayName: string;
  /** ひとこと紹介 — optional one-liner, same standing as displayName ("" = unset). */
  intro: string;
  items: Array<{ kind: string; title: string; text: string; tags: string[]; position: number }>;
};

/**
 * Validate a publish body. FAIL-CLOSED: anything off-shape rejects the whole
 * request (no partial acceptance of a malformed projection). The `private` /
 * `ownerId` key check is the boundary tripwire — those keys exist only on the
 * device side; their presence means something upstream posted raw memory.
 */
export function validatePublish(raw: unknown): { ok: true; value: CleanPublish } | { ok: false; reason: string } {
  if (!isRecord(raw)) return { ok: false, reason: "body" };
  if (!isOwnerToken(raw.ownerToken)) return { ok: false, reason: "token" };
  const displayName = typeof raw.displayName === "string" ? raw.displayName.trim() : "";
  if (displayName.length === 0 || displayName.length > MAX_NAME) {
    return { ok: false, reason: "display_name" };
  }
  // intro is OPTIONAL — absent/empty publishes as "" (never required); but a
  // present non-string or oversize value rejects the whole payload.
  if (raw.intro !== undefined && typeof raw.intro !== "string") {
    return { ok: false, reason: "intro" };
  }
  const intro = typeof raw.intro === "string" ? raw.intro.trim() : "";
  if (intro.length > MAX_INTRO) return { ok: false, reason: "intro" };
  if (!Array.isArray(raw.items) || raw.items.length > MAX_ITEMS) {
    return { ok: false, reason: "items" };
  }
  const items: CleanPublish["items"] = [];
  for (const [i, it] of raw.items.entries()) {
    if (!isRecord(it)) return { ok: false, reason: `item_${i}` };
    if ("private" in it || "ownerId" in it || "ownerToken" in it) {
      // Boundary tripwire: raw memory shapes never cross this line.
      return { ok: false, reason: "private_shape" };
    }
    if (typeof it.kind !== "string" || !MEET_KINDS.has(it.kind)) {
      return { ok: false, reason: `item_${i}_kind` };
    }
    if (typeof it.title !== "string" || it.title.length > MAX_TITLE) {
      return { ok: false, reason: `item_${i}_title` };
    }
    if (typeof it.text !== "string" || it.text.trim() === "" || it.text.length > MAX_TEXT) {
      return { ok: false, reason: `item_${i}_text` };
    }
    if (!Array.isArray(it.tags) || it.tags.length > MAX_TAGS) {
      return { ok: false, reason: `item_${i}_tags` };
    }
    const tags: string[] = [];
    for (const t of it.tags) {
      if (typeof t !== "string" || t.length > MAX_TAG) return { ok: false, reason: `item_${i}_tag` };
      tags.push(t);
    }
    items.push({ kind: it.kind, title: it.title, text: it.text, tags, position: items.length });
  }
  return { ok: true, value: { ownerToken: raw.ownerToken, displayName, intro, items } };
}

/** Same-origin write guard (lineage: functions/_ownerboard.ts). */
export function isAllowedWriteOrigin(request: Request): boolean {
  const origin = request.headers.get("Origin");
  if (!origin) return false;
  const url = new URL(request.url);
  const own = `${url.protocol}//${url.host}`;
  const fwdHost = request.headers.get("X-Forwarded-Host");
  const fwdProto = request.headers.get("X-Forwarded-Proto");
  const fwd =
    fwdHost && fwdProto
      ? `${fwdProto.split(",")[0].trim()}://${fwdHost.split(",")[0].trim()}`
      : null;
  return origin === own || (fwd !== null && origin === fwd);
}
