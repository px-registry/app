// Stage B+1 — memory → /search param allowlist (Cbp1-1, leak prevention).
//
// The single, audited place where owner memory may become a neutral /search
// param. Only saved_filter crosses; interest / note / preference return null and
// are NEVER sent (interest is matched client-side instead). `query` is included
// ONLY when the owner explicitly applies the filter — the agent's proactive
// proposal pass passes includeQuery:false, so owner-typed query text never leaves
// the device automatically.

import { isSurfaceShape, isIntent } from "../board/canonical.ts";
import type { OwnerMemoryV1 } from "../owner-memory/index.ts";
import type { SearchParamsAllowlist } from "./types.ts";

/**
 * Map a memory entry to neutral /search params, or null if it must never become
 * a server param. saved_filter → canonical params; everything else → null.
 *
 * Fail-closed on the narrowing: a stale saved_filter carrying a non-canonical
 * (removed) surface_shape such as "matching" — or a non-canonical intent — is
 * rejected WHOLESALE (null). The agent never sends "matching" to /search.
 */
export function memoryToSearchParams(
  entry: OwnerMemoryV1,
  opts: { includeQuery: boolean },
): SearchParamsAllowlist | null {
  if (entry.kind !== "saved_filter") {
    // interest / note / preference are NEVER sent to the server (Cbp1-1).
    return null;
  }
  const v = entry.value;
  if (v.surfaceShape !== undefined && !isSurfaceShape(v.surfaceShape)) return null;
  if (v.intent !== undefined && !isIntent(v.intent)) return null;
  const params: SearchParamsAllowlist = {};
  if (v.surfaceShape) params.surface_shape = v.surfaceShape;
  if (v.intent) params.intent = v.intent;
  if (v.category) params.category = v.category;
  if (v.region) params.region = v.region;
  // query crosses only on EXPLICIT owner apply, never on the proactive pass.
  if (opts.includeQuery && v.query) params.query = v.query;
  return params;
}

/** Build the URL query string for a neutral /search call from allowlist params. */
export function allowlistToQueryString(params: SearchParamsAllowlist): string {
  const sp = new URLSearchParams();
  if (params.surface_shape) sp.set("surface_shape", params.surface_shape);
  if (params.intent) sp.set("intent", params.intent);
  if (params.category) sp.set("category", params.category);
  if (params.region) sp.set("region", params.region);
  if (params.query) sp.set("q", params.query);
  return sp.toString();
}
