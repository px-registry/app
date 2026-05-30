// GET /api/search
//
// The Attested Board's read surface. Returns public board records (BoardRecordV1)
// from D1, filtered by the canonical, fail-closed query params. This is the only
// board endpoint in Stage A1: the board UI (/search/) lists rows from here, and
// the detail surface (/board/?id=…) reads one row via ?recordId=.
//
// Query params (all optional): surface_shape, intent, category, region, q,
// recordId, sort (newest|oldest). A non-canonical surface_shape/intent narrows
// to zero rows — it never widens (lib/board/query.ts).
//
// Boundary: every returned record carries the fixed machine-readable boundary
// and exposes only public fields (owner_handle is never projected). PX is not a
// seller/auctioneer/settler here — the response is the owner's own material.

import { queryBoard, type BoardEnv } from "../_board.ts";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

export const onRequestGet: PagesFunction<BoardEnv> = async ({ request, env }) => {
  const url = new URL(request.url);
  try {
    const records = await queryBoard(env.BOARD, url);
    return json({ records, count: records.length });
  } catch {
    // Fail closed: never leak an internal error body; the board simply has no
    // rows to show rather than exposing a stack or a partial row.
    return json({ records: [], count: 0, error: "search_unavailable" }, 500);
  }
};

export const onRequestOptions: PagesFunction<BoardEnv> = async () =>
  new Response(null, { status: 204, headers: CORS });
