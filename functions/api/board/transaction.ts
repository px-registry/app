// GET /api/board/transaction?recordId=…
//
// The assembled record chain for one listing: ordered events (event material),
// the public declarations, the declarationRefs (= the listing's receiptRefs), and
// the transaction boundary. Every column read is explicit and public — no
// owner_handle, no body, no PII.

import { readTransaction, type BoardDbEnv } from "../../_transaction.ts";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });

export const onRequestGet: PagesFunction<BoardDbEnv> = async ({ request, env }) => {
  const recordId = new URL(request.url).searchParams.get("recordId");
  if (!recordId) return json({ error: "recordId required" }, 400);
  try {
    const { object, declarations } = await readTransaction(env.BOARD, recordId);
    return json({ ...object, declarations });
  } catch {
    return json({ error: "transaction_unavailable" }, 500);
  }
};

export const onRequestOptions: PagesFunction<BoardDbEnv> = async () =>
  new Response(null, { status: 204, headers: CORS });
