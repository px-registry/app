// R1.5 meet AI — browser-direct inference. The ONLY file in lib/meet-ai that
// calls fetch (gate-pinned), and the calls go to the OWNER's provider with the
// OWNER's credential — never to a PX endpoint. PX runs no model and relays
// nothing (precedent: AiAssistPanel; the Anthropic call uses the documented
// browser-direct header).

import type { MeetModel } from "./models.ts";

export type GenerateInput = {
  model: MeetModel;
  apiKey: string; // openai/anthropic — ignored for ollama
  endpoint: string; // ollama — ignored otherwise
  prompt: string;
};

export type GenerateResult =
  | { ok: true; text: string }
  | { ok: false; error: "auth" | "rate" | "provider" | "network" };

function failFrom(status: number): GenerateResult {
  if (status === 401 || status === 403) return { ok: false, error: "auth" };
  if (status === 429) return { ok: false, error: "rate" };
  return { ok: false, error: "provider" };
}

/**
 * Reachability probe for the local lane (fix: 「つながっています」 is said only
 * after this succeeds — never assumed). Returns the installed model names so
 * the picker offers what the machine actually has.
 */
export async function probeOllama(
  endpoint: string,
): Promise<{ ok: true; models: string[] } | { ok: false }> {
  const base = (endpoint.trim() || "http://localhost:11434").replace(/\/+$/, "");
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(`${base}/api/tags`, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return { ok: false };
    const body = (await res.json()) as { models?: Array<{ name?: string }> };
    const models = (body.models ?? [])
      .map((m) => (typeof m.name === "string" ? m.name : ""))
      .filter((n) => n !== "");
    return { ok: true, models };
  } catch {
    return { ok: false };
  }
}

// ── 記憶装置 層2 — tool-use（常駐会話窓の agent loop が駆動）───────────────────
// generateProposals は単発の素のテキスト生成。ここは tool 往復を足した会話版:
// system ＋ messages（user/assistant/tool の列）＋ tools を送り、モデルの
// text と tool_use を受ける。anthropic / openai 対応。ollama の tool-use は
// 限定的（モデル依存）— ここでは unsupported を正直に返す（窓が鍵直行で案内）。

/** Tool 定義（PortToolDef と互換の最小形）。 */
export type ToolSpec = { name: string; description: string; inputSchema: Record<string, unknown> };

/** モデルが「この道具を使う」と言った一件。 */
export type ToolUse = { id: string; name: string; input: Record<string, unknown> };

/** 道具の実行結果（content は文字列・JSON は文字列で運ぶ＝MCP と同じ流儀）。 */
export type ToolResult = { id: string; content: string; isError?: boolean };

/** 会話の一手（owner-local の素の形 — provider 形へは pure mapper が写す）。 */
export type AgentMessage =
  | { role: "user"; text: string }
  | { role: "assistant"; text: string; toolUses: ToolUse[] }
  | { role: "tool"; results: ToolResult[] };

export type TurnResult =
  | { ok: true; text: string; toolUses: ToolUse[] }
  | { ok: false; error: "auth" | "rate" | "provider" | "network" | "unsupported" };

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function failTurnFrom(status: number): TurnResult {
  if (status === 401 || status === 403) return { ok: false, error: "auth" };
  if (status === 429) return { ok: false, error: "rate" };
  return { ok: false, error: "provider" };
}

// ── pure mappers（テスト可能・fetch を持たない）────────────────────────────────

/** owner-local の messages → Anthropic Messages API の body 形。 */
export function toAnthropicBody(
  model: string,
  system: string,
  messages: AgentMessage[],
  tools: ToolSpec[],
): Record<string, unknown> {
  const msgs = messages.map((m) => {
    if (m.role === "user") return { role: "user", content: m.text };
    if (m.role === "assistant") {
      const content: Record<string, unknown>[] = [];
      if (m.text.trim() !== "") content.push({ type: "text", text: m.text });
      for (const t of m.toolUses) content.push({ type: "tool_use", id: t.id, name: t.name, input: t.input });
      return { role: "assistant", content };
    }
    return {
      role: "user",
      content: m.results.map((r) => ({
        type: "tool_result",
        tool_use_id: r.id,
        content: r.content,
        ...(r.isError ? { is_error: true } : {}),
      })),
    };
  });
  return {
    model,
    max_tokens: 2000,
    ...(system.trim() !== "" ? { system } : {}),
    messages: msgs,
    tools: tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.inputSchema })),
  };
}

/** Anthropic 応答 body → TurnResult（text ＋ tool_use を拾う・fail-closed）。 */
export function parseAnthropicTurn(body: unknown): { text: string; toolUses: ToolUse[] } {
  const content = isRecord(body) && Array.isArray(body.content) ? body.content : [];
  let text = "";
  const toolUses: ToolUse[] = [];
  for (const block of content) {
    if (!isRecord(block)) continue;
    if (block.type === "text" && typeof block.text === "string") text += block.text;
    else if (block.type === "tool_use" && typeof block.id === "string" && typeof block.name === "string") {
      toolUses.push({ id: block.id, name: block.name, input: isRecord(block.input) ? block.input : {} });
    }
  }
  return { text, toolUses };
}

/** owner-local の messages → OpenAI chat.completions の body 形。 */
export function toOpenAIBody(
  model: string,
  system: string,
  messages: AgentMessage[],
  tools: ToolSpec[],
): Record<string, unknown> {
  const msgs: Record<string, unknown>[] = [];
  if (system.trim() !== "") msgs.push({ role: "system", content: system });
  for (const m of messages) {
    if (m.role === "user") msgs.push({ role: "user", content: m.text });
    else if (m.role === "assistant") {
      msgs.push({
        role: "assistant",
        content: m.text,
        ...(m.toolUses.length > 0
          ? {
              tool_calls: m.toolUses.map((t) => ({
                id: t.id,
                type: "function",
                function: { name: t.name, arguments: JSON.stringify(t.input) },
              })),
            }
          : {}),
      });
    } else {
      for (const r of m.results) {
        msgs.push({ role: "tool", tool_call_id: r.id, content: r.content });
      }
    }
  }
  return {
    model,
    messages: msgs,
    tools: tools.map((t) => ({
      type: "function",
      function: { name: t.name, description: t.description, parameters: t.inputSchema },
    })),
  };
}

/** OpenAI 応答 body → TurnResult（fail-closed: 壊れた arguments は {} 扱い）。 */
export function parseOpenAITurn(body: unknown): { text: string; toolUses: ToolUse[] } {
  const choice =
    isRecord(body) && Array.isArray(body.choices) && isRecord(body.choices[0]) ? body.choices[0] : null;
  const message = choice !== null && isRecord(choice.message) ? choice.message : null;
  const text = message !== null && typeof message.content === "string" ? message.content : "";
  const calls = message !== null && Array.isArray(message.tool_calls) ? message.tool_calls : [];
  const toolUses: ToolUse[] = [];
  for (const c of calls) {
    if (!isRecord(c) || typeof c.id !== "string" || !isRecord(c.function)) continue;
    const fn = c.function;
    if (typeof fn.name !== "string") continue;
    let input: Record<string, unknown> = {};
    if (typeof fn.arguments === "string") {
      try {
        const parsed: unknown = JSON.parse(fn.arguments);
        if (isRecord(parsed)) input = parsed;
      } catch {
        /* fail-closed: 壊れた arguments は空 */
      }
    }
    toolUses.push({ id: c.id, name: fn.name, input });
  }
  return { text, toolUses };
}

/** 一手生成（tool 往復つき）。provider 直・owner 鍵・PX 非中継。 */
export async function generateTurn(input: {
  model: MeetModel;
  apiKey: string;
  endpoint: string;
  system: string;
  messages: AgentMessage[];
  tools: ToolSpec[];
}): Promise<TurnResult> {
  try {
    if (input.model.provider === "anthropic") {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": input.apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify(toAnthropicBody(input.model.id, input.system, input.messages, input.tools)),
      });
      if (!res.ok) return failTurnFrom(res.status);
      const { text, toolUses } = parseAnthropicTurn(await res.json());
      return { ok: true, text, toolUses };
    }
    if (input.model.provider === "openai") {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${input.apiKey}` },
        body: JSON.stringify(toOpenAIBody(input.model.id, input.system, input.messages, input.tools)),
      });
      if (!res.ok) return failTurnFrom(res.status);
      const { text, toolUses } = parseOpenAITurn(await res.json());
      return { ok: true, text, toolUses };
    }
    // ollama — tool-use はモデル依存で不安定。窓は鍵直行（anthropic/openai）で動く。
    return { ok: false, error: "unsupported" };
  } catch {
    return { ok: false, error: "network" };
  }
}

export async function generateProposals(input: GenerateInput): Promise<GenerateResult> {
  try {
    if (input.model.provider === "anthropic") {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": input.apiKey,
          "anthropic-version": "2023-06-01",
          // Documented opt-in for calling the API straight from a browser with
          // the user's OWN key (exactly this architecture).
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: input.model.id,
          max_tokens: 2000,
          messages: [{ role: "user", content: input.prompt }],
        }),
      });
      if (!res.ok) return failFrom(res.status);
      const body = (await res.json()) as { content?: Array<{ type?: string; text?: string }> };
      const text = (body.content ?? [])
        .map((c) => (typeof c.text === "string" ? c.text : ""))
        .join("");
      return text.trim() === "" ? { ok: false, error: "provider" } : { ok: true, text };
    }

    if (input.model.provider === "openai") {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${input.apiKey}`,
        },
        body: JSON.stringify({
          model: input.model.id,
          messages: [{ role: "user", content: input.prompt }],
        }),
      });
      if (!res.ok) return failFrom(res.status);
      const body = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const text = body.choices?.[0]?.message?.content ?? "";
      return text.trim() === "" ? { ok: false, error: "provider" } : { ok: true, text };
    }

    // ollama — local endpoint, no key
    const base = (input.endpoint.trim() || "http://localhost:11434").replace(/\/+$/, "");
    const res = await fetch(`${base}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: input.model.id.replace(/^ollama:/, ""),
        prompt: input.prompt,
        stream: false,
      }),
    });
    if (!res.ok) return failFrom(res.status);
    const body = (await res.json()) as { response?: string };
    const text = body.response ?? "";
    return text.trim() === "" ? { ok: false, error: "provider" } : { ok: true, text };
  } catch {
    return { ok: false, error: "network" };
  }
}
