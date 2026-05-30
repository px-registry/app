// Attested Board — search/filter (pure).
//
// All board filtering lives here, in one tested place, over an in-memory array.
// The /search Function fetches rows from D1 and runs them through this — so the
// canonical rules (fail-closed on a non-canonical filter, user-selected sort
// only, no hidden ranking) are enforced once and tested directly, without D1.
//
// At seed scale (a handful of rows) fetch-all-then-filter is exact and simple;
// when the board grows, the equality filters move into SQL WHERE + indices
// (Stage A2+) while this stays the source of truth for ordering and free-text.

import { isSurfaceShape, isIntent } from "./canonical.ts";
import type { SurfaceShape, Intent } from "./canonical.ts";
import type { PublicBoardRow } from "./types.ts";

/** User-selected sort. The ONLY ordering inputs — no relevance/boost/score. */
export type BoardSort = "newest" | "oldest";

export interface BoardSearchParams {
  surfaceShape?: SurfaceShape;
  intent?: Intent;
  category?: string;
  region?: string;
  /** Free-text, matched against title/summary/category/region. */
  q?: string;
  /** Exact-record lookup (powers the public detail surface). */
  recordId?: string;
  sort: BoardSort;
  /**
   * Fail-closed flag. Set when an explicit surface_shape/intent param was given
   * but is NOT canonical. filterBoard then returns [] rather than silently
   * widening to every row — a bad filter narrows, never broadens.
   */
  invalid: boolean;
}

/** Parse a URL query into canonical, fail-closed search params. */
export function parseSearchParams(sp: URLSearchParams): BoardSearchParams {
  let invalid = false;

  const rawShape = sp.get("surface_shape");
  let surfaceShape: SurfaceShape | undefined;
  if (rawShape !== null) {
    if (isSurfaceShape(rawShape)) surfaceShape = rawShape;
    else invalid = true; // non-canonical filter → fail closed
  }

  const rawIntent = sp.get("intent");
  let intent: Intent | undefined;
  if (rawIntent !== null) {
    if (isIntent(rawIntent)) intent = rawIntent;
    else invalid = true;
  }

  const trim = (s: string | null) => {
    const t = (s ?? "").trim();
    return t ? t : undefined;
  };

  const sortRaw = sp.get("sort");
  const sort: BoardSort = sortRaw === "oldest" ? "oldest" : "newest";

  return {
    surfaceShape,
    intent,
    category: trim(sp.get("category")),
    region: trim(sp.get("region")),
    q: trim(sp.get("q")),
    recordId: trim(sp.get("recordId")),
    sort,
    invalid,
  };
}

function matchesText(row: PublicBoardRow, needle: string): boolean {
  const hay = [row.title, row.summary, row.category, row.region]
    .filter((v): v is string => typeof v === "string")
    .join("\n")
    .toLowerCase();
  return hay.includes(needle.toLowerCase());
}

/**
 * Filter + sort. Pure: same input, same output. Ordering is strictly the
 * user-selected createdAt direction — there is no hidden score, recency boost,
 * or paid placement (gate 9A-10).
 */
export function filterBoard(
  rows: readonly PublicBoardRow[],
  params: BoardSearchParams,
): PublicBoardRow[] {
  if (params.invalid) return [];

  const out = rows.filter((row) => {
    if (params.recordId && row.recordId !== params.recordId) return false;
    if (params.surfaceShape && row.surfaceShape !== params.surfaceShape) return false;
    if (params.intent && row.intent !== params.intent) return false;
    if (params.category && row.category !== params.category) return false;
    if (params.region && row.region !== params.region) return false;
    if (params.q && !matchesText(row, params.q)) return false;
    return true;
  });

  const dir = params.sort === "oldest" ? 1 : -1;
  // Tie-break on recordId so the order is total and deterministic (never a
  // hidden signal — just a stable secondary key).
  out.sort((a, b) => {
    const c = a.createdAt.localeCompare(b.createdAt);
    if (c !== 0) return c * dir;
    return a.recordId.localeCompare(b.recordId) * dir;
  });
  return out;
}
