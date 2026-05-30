// GET /api/board/contact?recordId=…
//
// The inquiry/contact route (A2). It RESOLVES the listing's owner-controlled
// external contact (a sanitized URL) and hands it back. PX does not relay,
// broker, or store any message — the visitor contacts the owner off-platform.
// No write, no body, no PII. The transaction boundary is stamped so a reader can
// see PX's role mechanically (including pxDoesNotHoldMessageBody).

import { resolveContactUrl, TRANSACTION_BOUNDARY, type BoardDbEnv } from "../../_transaction.ts";

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
    const contactActionUrl = await resolveContactUrl(env.BOARD, recordId);
    return json({ contactActionUrl, machineReadableBoundary: TRANSACTION_BOUNDARY });
  } catch {
    return json({ contactActionUrl: null, machineReadableBoundary: TRANSACTION_BOUNDARY }, 500);
  }
};

export const onRequestOptions: PagesFunction<BoardDbEnv> = async () =>
  new Response(null, { status: 204, headers: CORS });
