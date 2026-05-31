// Board Templates — owner-local ↔ server reconciliation (UI Wiring v0, PURE).
//
// The "server-confirmed only" state machine for a draft row's relationship to the
// public board. Every function here is PURE — no network, no DOM, no Cloudflare
// globals (the Board Templates lib must make no network call; the fetch lives in
// the component). The store applies these transitions; the UI reads the derived
// state. The whole machine is node-tested without a browser.
//
// Principle (MF1–MF4): a row becomes `public` ONLY when the server confirms it;
// a local edit never silently updates the server; an ambiguous publish result is
// `unknown`, never treated as public.

import type { DraftBoardRow, RowServerState } from "./types.ts";

/** The five display states a row can be in (server.kind, defaulting to local). */
export const ROW_SERVER_STATES = [
  "local",
  "public",
  "local-edits-not-published",
  "retired",
  "unknown",
] as const;
export type RowServerStateKind = (typeof ROW_SERVER_STATES)[number];

/** The display state of a row — its server kind, or `local` when there is none. */
export function rowServerStateKind(row: Pick<DraftBoardRow, "server">): RowServerStateKind {
  return row.server?.kind ?? "local";
}

/**
 * The LIVE server record_id the owner can unpublish, if any. Present while the row
 * is `public` or `local-edits-not-published` (the server row still exists). A
 * `retired` row has no live record; an `unknown` row has no confirmed record.
 */
export function publishedRecordIdOf(row: Pick<DraftBoardRow, "server">): string | undefined {
  const s = row.server;
  if (!s) return undefined;
  return s.kind === "public" || s.kind === "local-edits-not-published" ? s.recordId : undefined;
}

// ── transitions (server-confirmed only) ──────────────────────────────────────

export function serverPublished(recordId: string): RowServerState {
  return { kind: "public", recordId };
}
export function serverRetired(recordId: string): RowServerState {
  return { kind: "retired", recordId };
}
export function serverUnknown(): RowServerState {
  return { kind: "unknown" };
}

/**
 * The server state after a LOCAL edit (MF4): a published row becomes
 * `local-edits-not-published` (its edits are NOT on the server — reflect via
 * unpublish → edit → re-publish). A `retired`/`unknown` row returns to purely
 * local (`undefined`) — a fresh edit starts over. Other states are unchanged.
 */
export function serverAfterEdit(server: RowServerState | undefined): RowServerState | undefined {
  if (!server) return undefined;
  if (server.kind === "public") return { kind: "local-edits-not-published", recordId: server.recordId };
  if (server.kind === "retired" || server.kind === "unknown") return undefined;
  return server; // local-edits-not-published stays
}

/** Whether a row's content (the published material) differs between two versions. */
export function rowContentChanged(
  a: Pick<DraftBoardRow, "surfaceShape" | "intent" | "title" | "summary">,
  b: Pick<DraftBoardRow, "surfaceShape" | "intent" | "title" | "summary">,
): boolean {
  return (
    a.surfaceShape !== b.surfaceShape ||
    a.intent !== b.intent ||
    a.title !== b.title ||
    (a.summary ?? "") !== (b.summary ?? "")
  );
}
