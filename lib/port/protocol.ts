// R2 GOAL — チャットポート（内部名・spec §12(b): LLM が会場・PX が客）。
// MCP (Model Context Protocol) streamable HTTP の配管 — 純関数のみ。
//
// この層はプロトコルの「形」だけを知る: JSON-RPC の解釈・応答の組み立て・
// バージョン交渉。D1 にも fetch にも触れない（実行は functions/port/mcp.ts
// ただ一箇所）。stateless — セッション id を発行しない。presence・既読の
// 裏口をプロトコル層にも作らない、は UI と同じ文法。
//
// fail-closed: 形が読めない入力は null / エラー応答 — 推測で実行しない。

export type JsonRpcId = string | number;

export type JsonRpcRequest = {
  jsonrpc: "2.0";
  /** undefined = notification（応答を返さない）。 */
  id?: JsonRpcId;
  method: string;
  params?: Record<string, unknown>;
};

export type JsonRpcResponse = {
  jsonrpc: "2.0";
  id: JsonRpcId | null;
  result?: unknown;
  error?: { code: number; message: string };
};

// JSON-RPC 2.0 の標準コード（このポートが使う分だけ）。
export const RPC_PARSE_ERROR = -32700;
export const RPC_INVALID_REQUEST = -32600;
export const RPC_METHOD_NOT_FOUND = -32601;
export const RPC_INVALID_PARAMS = -32602;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function parseOne(raw: unknown): JsonRpcRequest | null {
  if (!isRecord(raw)) return null;
  if (raw.jsonrpc !== "2.0" || typeof raw.method !== "string" || raw.method === "") return null;
  const id =
    typeof raw.id === "string" || typeof raw.id === "number" ? raw.id : undefined;
  // id が変な形（object 等）で乗っていたら notification 扱いにせず拒否する
  if ("id" in raw && id === undefined && raw.id !== null) return null;
  const params = isRecord(raw.params) ? raw.params : undefined;
  return { jsonrpc: "2.0", ...(id !== undefined ? { id } : {}), method: raw.method, ...(params !== undefined ? { params } : {}) };
}

/**
 * Parse a POST body into messages. A single message or a batch array; anything
 * off-shape → null（呼び出し側が -32700/-32600 で正直に返す）。
 */
export function parseRpc(raw: unknown): { messages: JsonRpcRequest[]; batch: boolean } | null {
  if (Array.isArray(raw)) {
    if (raw.length === 0) return null;
    const messages: JsonRpcRequest[] = [];
    for (const m of raw) {
      const p = parseOne(m);
      if (p === null) return null;
      messages.push(p);
    }
    return { messages, batch: true };
  }
  const one = parseOne(raw);
  return one === null ? null : { messages: [one], batch: false };
}

export function isNotification(msg: JsonRpcRequest): boolean {
  return msg.id === undefined;
}

export function rpcResult(id: JsonRpcId, result: unknown): JsonRpcResponse {
  return { jsonrpc: "2.0", id, result };
}

export function rpcError(id: JsonRpcId | null, code: number, message: string): JsonRpcResponse {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

// ── MCP initialize ──────────────────────────────────────────────────────────────
//
// 知っているリビジョンは echo、知らない指定は最新で答える（クライアント側が
// 受けられない場合は接続を諦める — こちらが嘘のバージョンを名乗ることはない）。

export const MCP_PROTOCOL_VERSIONS = Object.freeze([
  "2024-11-05",
  "2025-03-26",
  "2025-06-18",
]) as readonly string[];

export function negotiateProtocolVersion(requested: unknown): string {
  if (typeof requested === "string" && MCP_PROTOCOL_VERSIONS.includes(requested)) {
    return requested;
  }
  return MCP_PROTOCOL_VERSIONS[MCP_PROTOCOL_VERSIONS.length - 1];
}

/** ツール呼び出しの返し — MCP の content 形（text 一枚・JSON は文字列で運ぶ）。 */
export function toolText(text: string, isError = false): unknown {
  return { content: [{ type: "text", text }], ...(isError ? { isError: true } : {}) };
}

/** 構造データはそのまま JSON 文字列に（チャット側 LLM が読む）。 */
export function toolJson(value: unknown, isError = false): unknown {
  return toolText(JSON.stringify(value, null, 1), isError);
}
