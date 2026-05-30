// Stage B — saved_filter application (OWNER-SIDE only).
//
// Save ↔ apply are separated (§5/C5). The filter is SAVED owner-local; it is
// APPLIED only by the owner's own client building EXPLICIT /search params and
// navigating to the neutral board. The PX /search server never reads owner
// memory — so the same params give every owner the same response. This module is
// the owner-side composition; it touches no server and infers nothing.

import { BOARD_SEARCH_PATH } from "../board/index.ts";
import type { SavedFilterValue } from "./types.ts";

/** Turn a saved filter into the explicit, neutral /search query params. */
export function savedFilterToSearchParams(value: SavedFilterValue): URLSearchParams {
  const sp = new URLSearchParams();
  if (value.surfaceShape) sp.set("surface_shape", value.surfaceShape);
  if (value.intent) sp.set("intent", value.intent);
  if (value.category) sp.set("category", value.category);
  if (value.region) sp.set("region", value.region);
  if (value.query) sp.set("q", value.query);
  return sp;
}

/** The board path the owner navigates to when applying a saved filter. */
export function savedFilterToSearchPath(value: SavedFilterValue): string {
  const qs = savedFilterToSearchParams(value).toString();
  return qs ? `${BOARD_SEARCH_PATH}?${qs}` : BOARD_SEARCH_PATH;
}

/** A short human summary of a saved filter, for the memory list UI. */
export function describeSavedFilter(value: SavedFilterValue): string {
  const parts: string[] = [];
  if (value.surfaceShape) parts.push(value.surfaceShape);
  if (value.intent) parts.push(value.intent);
  if (value.category) parts.push(value.category);
  if (value.region) parts.push(value.region);
  if (value.query) parts.push(`“${value.query}”`);
  return parts.length ? parts.join(" · ") : "all of the board";
}
