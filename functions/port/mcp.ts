// POST /port/mcp — チャットポート（spec §12(b): LLM が会場・PX が客）。
//
// 「あなたのAI」（owner が普段使うチャット LLM）が MCP コネクタとしてこの一枚に
// 繋がり、owner のために部屋を見回り（P0 read）、owner の確認を経て外へ出る操作
// （P1 write）を行う。実行体はチャット側 — PX は AI を実行しない。
//
// 憲法（このルートで構造的に守られるもの）:
//   * 認証 = owner token（Authorization: Bearer か ?k=）。derive して即 DROP —
//     保存しない・ログしない・応答に乗せない（_meet.ts と同じ文法）。
//   * read は本人の見えるものだけ（公開プール・自分宛 edge・気配の数・封書の件数）。
//     封書の中身（ciphertext）はここから読めない — 鍵は端末にしかない。
//   * 平文のトーク本文を受ける tool は存在しない（0013 invariant 1 の port 版）。
//     draft_talk_link は edge の検証だけ行い、下書きは URL フラグメント（# 以降 —
//     ブラウザがサーバに送らない部分）でチャット→owner に渡る。
//   * 会話の保管なし・順位付けなし・通知なし（pull 原則 — PX から呼び出さない）。
//   * stateless — セッション id を発行しない。
//
// プロトコル: MCP streamable HTTP（JSON 応答のみ・SSE なし — 仕様上 stateless
// サーバは単発 JSON application/json で応答してよい。GET は 405）。

import {
  json,
  deriveParticipantRef,
  isOwnerToken,
  type MeetEnv,
} from "../_meet.ts";
import {
  parseRpc,
  isNotification,
  rpcResult,
  rpcError,
  negotiateProtocolVersion,
  toolText,
  RPC_PARSE_ERROR,
  RPC_INVALID_REQUEST,
  RPC_METHOD_NOT_FOUND,
  RPC_INVALID_PARAMS,
  type JsonRpcRequest,
  type JsonRpcResponse,
} from "../../lib/port/protocol.ts";
import { PORT_SERVER_NAME, PORT_SERVER_VERSION } from "../../lib/port/manifest.ts";
import { PORT_TOOLS } from "../../lib/port/tools.ts";
import { callPortTool } from "./handlers-core.ts";

// ── 認証 — owner token（per-owner・fail-closed）─────────────────────────────────
// Bearer ヘッダが一義。ヘッダを運べないコネクタのために ?k= も受ける（URL に
// 乗るのは owner 自身の合鍵を owner 自身のエージェント設定に貼った場合だけ —
// サーバはこれをログしない・保存しない）。

function tokenFrom(request: Request): string | null {
  const h = request.headers.get("Authorization") ?? "";
  if (h.startsWith("Bearer ")) {
    const t = h.slice("Bearer ".length).trim();
    if (isOwnerToken(t)) return t;
  }
  const k = new URL(request.url).searchParams.get("k") ?? "";
  return isOwnerToken(k) ? k : null;
}

// ── tools/call — 実装は単一臓器（handlers-core）に委譲する ──────────────────────
// ここ（MCP transport）と PX 内の窓（agent → meet-net portCall → /port/mcp）は、
// 同じ callPortTool を通る。SQL も道具の本体もこのファイルには無い。

async function callTool(
  env: MeetEnv,
  origin: string,
  me: string,
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  return callPortTool(env, origin, me, name, args);
}


// ── JSON-RPC dispatch ───────────────────────────────────────────────────────────

async function handleMessage(
  env: MeetEnv,
  origin: string,
  me: string,
  msg: JsonRpcRequest,
): Promise<JsonRpcResponse | null> {
  if (isNotification(msg)) return null; // notifications/initialized など — 受けて流す
  const id = msg.id as NonNullable<JsonRpcRequest["id"]>;

  if (msg.method === "initialize") {
    return rpcResult(id, {
      protocolVersion: negotiateProtocolVersion(msg.params?.protocolVersion),
      capabilities: { tools: {} },
      serverInfo: { name: PORT_SERVER_NAME, version: PORT_SERVER_VERSION },
      instructions:
        "PX のチャットポートです。最初に get_law_and_manifest を読んでください。pull 原則 — owner に頼まれた時だけ動きます。外へ出る操作は owner の確認を得てから。",
    });
  }
  if (msg.method === "ping") return rpcResult(id, {});
  if (msg.method === "tools/list") {
    return rpcResult(id, {
      tools: PORT_TOOLS.map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
        ...(t.annotations !== undefined ? { annotations: t.annotations } : {}),
      })),
    });
  }
  if (msg.method === "tools/call") {
    const name = typeof msg.params?.name === "string" ? msg.params.name : "";
    const args =
      typeof msg.params?.arguments === "object" &&
      msg.params.arguments !== null &&
      !Array.isArray(msg.params.arguments)
        ? (msg.params.arguments as Record<string, unknown>)
        : {};
    if (name === "") return rpcError(id, RPC_INVALID_PARAMS, "tool name required");
    try {
      return rpcResult(id, await callTool(env, origin, me, name, args));
    } catch {
      // fail-closed・正直: 内部事情は漏らさず、失敗の事実だけ返す
      return rpcResult(id, toolText("実行できませんでした（サーバ側の失敗）。", true));
    }
  }
  return rpcError(id, RPC_METHOD_NOT_FOUND, `method not found: ${msg.method}`);
}

export const onRequestPost: PagesFunction<MeetEnv> = async ({ request, env }) => {
  const token = tokenFrom(request);
  if (token === null) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }
  const me = await deriveParticipantRef(token);
  // token はここで用済み — 以後 ref だけが流れる（保存もログもしない）

  const raw: unknown = await request.json().catch(() => null);
  if (raw === null) {
    return json(rpcError(null, RPC_PARSE_ERROR, "parse error"), 400);
  }
  const parsed = parseRpc(raw);
  if (parsed === null) {
    return json(rpcError(null, RPC_INVALID_REQUEST, "invalid request"), 400);
  }

  const origin = new URL(request.url).origin;
  const out: JsonRpcResponse[] = [];
  for (const msg of parsed.messages) {
    const res = await handleMessage(env, origin, me, msg);
    if (res !== null) out.push(res);
  }
  if (out.length === 0) return new Response(null, { status: 202 });
  return json(parsed.batch ? out : out[0]);
};

/** GET = SSE ストリームは提供しない（stateless）— 仕様どおり 405 で正直に。 */
export const onRequestGet: PagesFunction<MeetEnv> = async () =>
  json({ ok: false, error: "method_not_allowed", hint: "POST (MCP streamable HTTP) only" }, 405);

export const onRequestOptions: PagesFunction<MeetEnv> = async () =>
  new Response(null, { status: 204, headers: { Allow: "POST, OPTIONS" } });
