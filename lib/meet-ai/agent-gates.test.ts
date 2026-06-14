// 記憶装置 層2 — agent loop ＋ tool-use の pin。Run with `node --test`.
//
//   AG-1  write 二態 confirm 必須: write 系（port write ＋ 蒸留）は confirmWrite が
//         true を返すまで実行されない（fail-closed）。断りは declined 結果で残る（沈黙の禁止）
//   AG-2  read 自動・readOnly: read 系は confirmWrite を経ずに portCall で実行される
//   AG-3  蒸留の append 形: remember_this ✅ → content record・sourceRef channel="talk"・
//         threadRef 付き・private 既定・provenance owner_written で append
//   AG-4  no-log 貫徹: agent.ts は fetch も submitLog も PX endpoint も持たない
//   AG-5  沈黙の禁止 / 終端: LLM 失敗でも assistant の正直な一行が残る・道具尽きで終わる
//   AG-6  buildDistillRecord は fail-closed（形が崩れたら null＝書かない）
//   GT-*  generate tool-use の pure mapper（anthropic/openai 往復形）

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  runAgentTurn,
  agentTools,
  isReadTool,
  isWriteTool,
  buildDistillRecord,
  REMEMBER_TOOL_NAME,
  type AgentDeps,
} from "./agent.ts";
import {
  toAnthropicBody,
  parseAnthropicTurn,
  toOpenAIBody,
  parseOpenAITurn,
  generateTurn,
  type AgentMessage,
  type TurnResult,
  type ToolUse,
} from "./generate.ts";
import { findModel } from "./models.ts";
import type { NewContentRecordV1 } from "../meet-memory/journal-types.ts";

// ── fakes ────────────────────────────────────────────────────────────────────

function scriptedLlm(turns: TurnResult[]): {
  llm: AgentDeps["llm"];
  calls: number;
} {
  let i = 0;
  const state = { calls: 0 };
  const llm: AgentDeps["llm"] = async () => {
    state.calls++;
    return turns[i++] ?? { ok: true, text: "（おわり）", toolUses: [] };
  };
  return { llm, get calls() { return state.calls; } };
}

function makeDeps(over: Partial<AgentDeps> & { confirm?: boolean }): {
  deps: AgentDeps;
  portCalls: Array<{ name: string; args: Record<string, unknown> }>;
  confirmCalls: Array<{ name: string }>;
  appended: NewContentRecordV1[];
} {
  const portCalls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const confirmCalls: Array<{ name: string }> = [];
  const appended: NewContentRecordV1[] = [];
  const deps: AgentDeps = {
    llm: over.llm ?? (async () => ({ ok: true, text: "hi", toolUses: [] })),
    portCall:
      over.portCall ??
      (async (name, args) => {
        portCalls.push({ name, args });
        return { content: JSON.stringify({ ok: true }), isError: false };
      }),
    confirmWrite:
      over.confirmWrite ??
      (async (req) => {
        confirmCalls.push({ name: req.name });
        return over.confirm ?? false;
      }),
    appendMemory:
      over.appendMemory ??
      (async (rec) => {
        appended.push(rec);
      }),
  };
  return { deps, portCalls, confirmCalls, appended };
}

const use = (name: string, input: Record<string, unknown> = {}): ToolUse => ({ id: `tu_${name}`, name, input });
const userMsg = (text: string): AgentMessage => ({ role: "user", text });

// ── AG-2: read 自動 ───────────────────────────────────────────────────────────

test("AG-2: a read tool runs automatically, never asking for confirmation", async () => {
  const { llm } = scriptedLlm([
    { ok: true, text: "", toolUses: [use("read_candidates")] },
    { ok: true, text: "候補を読みました。", toolUses: [] },
  ]);
  const { deps, portCalls, confirmCalls } = makeDeps({ llm });
  const convo = await runAgentTurn(deps, "SYS", [userMsg("候補ある?")]);
  assert.deepEqual(portCalls.map((c) => c.name), ["read_candidates"], "read executed");
  assert.equal(confirmCalls.length, 0, "read never asks owner to confirm");
  assert.equal(convo.at(-1)?.role, "assistant");
});

// ── AG-1: write 二態 ────────────────────────────────────────────────────────────

test("AG-1: a write tool is NOT executed when the owner declines", async () => {
  const { llm } = scriptedLlm([
    { ok: true, text: "", toolUses: [use("send_signal", { toRef: "a".repeat(16), basisItemRef: "b".repeat(16) })] },
    { ok: true, text: "見送りました。", toolUses: [] },
  ]);
  const { deps, portCalls, confirmCalls } = makeDeps({ llm, confirm: false });
  const convo = await runAgentTurn(deps, "SYS", [userMsg("送って")]);
  assert.deepEqual(confirmCalls.map((c) => c.name), ["send_signal"], "owner was asked");
  assert.equal(portCalls.length, 0, "declined write never reaches the port (fail-closed)");
  // 沈黙の禁止: the decline is a visible tool result, not silence
  const toolTurn = convo.find((m) => m.role === "tool");
  assert.ok(toolTurn && toolTurn.role === "tool" && toolTurn.results[0].content.includes("declined"));
});

test("AG-1b: a write tool executes only after the owner approves", async () => {
  const { llm } = scriptedLlm([
    { ok: true, text: "", toolUses: [use("place_question", { text: "新しい現場を探している" })] },
    { ok: true, text: "立てました。", toolUses: [] },
  ]);
  const { deps, portCalls, confirmCalls } = makeDeps({ llm, confirm: true });
  await runAgentTurn(deps, "SYS", [userMsg("アンテナ立てて")]);
  assert.deepEqual(confirmCalls.map((c) => c.name), ["place_question"]);
  assert.deepEqual(portCalls.map((c) => c.name), ["place_question"], "approved write reaches the port");
});

test("AG-1c: draft_talk_link is treated as a write (owner-confirmed) despite readOnlyHint", async () => {
  const { llm } = scriptedLlm([
    { ok: true, text: "", toolUses: [use("draft_talk_link", { edgeId: "edge_" + "a".repeat(16) })] },
    { ok: true, text: "リンクです。", toolUses: [] },
  ]);
  const { deps, portCalls, confirmCalls } = makeDeps({ llm, confirm: false });
  await runAgentTurn(deps, "SYS", [userMsg("トークの下書き")]);
  assert.deepEqual(confirmCalls.map((c) => c.name), ["draft_talk_link"], "asked before producing the link");
  assert.equal(portCalls.length, 0, "declined → no link produced");
});

// ── AG-3: 蒸留の append 形 ───────────────────────────────────────────────────────

test("AG-3: remember_this ✅ appends a talk-channel content record (private, owner_written)", async () => {
  const { llm } = scriptedLlm([
    { ok: true, text: "", toolUses: [use(REMEMBER_TOOL_NAME, { kind: "want", title: "店長", text: "店長を探し始めた", tags: ["新店"] })] },
    { ok: true, text: "残しました。", toolUses: [] },
  ]);
  const { deps, appended, portCalls } = makeDeps({ llm, confirm: true });
  await runAgentTurn(deps, "SYS", [userMsg("今の話覚えて")], { threadRef: "thread-1" });
  assert.equal(appended.length, 1, "one record appended");
  const rec = appended[0];
  assert.equal(rec.contentKind, "rig_item");
  assert.equal(rec.provenance, "owner_written");
  assert.deepEqual(rec.sourceRef, { channel: "talk", threadRef: "thread-1", messageRef: "0-0" });
  assert.equal(rec.body.private, true, "distilled facts are private by default (fail-closed)");
  assert.equal(rec.body.text, "店長を探し始めた");
  assert.equal(portCalls.length, 0, "蒸留 is local — never touches the port");
});

test("AG-3b: remember_this declined → nothing is written", async () => {
  const { llm } = scriptedLlm([
    { ok: true, text: "", toolUses: [use(REMEMBER_TOOL_NAME, { kind: "memory", text: "x" })] },
    { ok: true, text: "ok", toolUses: [] },
  ]);
  const { deps, appended } = makeDeps({ llm, confirm: false });
  await runAgentTurn(deps, "SYS", [userMsg("覚えて")]);
  assert.equal(appended.length, 0, "no write without ✅");
});

// ── AG-5: 沈黙の禁止 / 終端 ──────────────────────────────────────────────────────

test("AG-5: an LLM failure still lands an honest assistant line (never silence)", async () => {
  const { llm } = scriptedLlm([{ ok: false, error: "auth" }]);
  const { deps } = makeDeps({ llm });
  const convo = await runAgentTurn(deps, "SYS", [userMsg("hi")]);
  const last = convo.at(-1);
  assert.ok(last && last.role === "assistant" && last.text.length > 0, "honest line on failure");
});

test("AG-5b: the loop terminates on a no-tool turn and respects maxSteps", async () => {
  // a model that always asks for a read would loop forever without the cap
  const deps = makeDeps({
    llm: async () => ({ ok: true, text: "", toolUses: [use("read_inbox")] }),
  }).deps;
  const convo = await runAgentTurn(deps, "SYS", [userMsg("loop")], { maxSteps: 3 });
  // last turn is the honest stop line; no throw, bounded
  assert.ok(convo.at(-1)?.role === "assistant");
});

// ── AG-4: no-log（構造）─────────────────────────────────────────────────────────

test("AG-4: agent.ts holds no fetch / submitLog / PX endpoint (no-log structural)", () => {
  const src = readFileSync(new URL("./agent.ts", import.meta.url), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");
  assert.ok(!/\bfetch\s*\(/.test(src), "agent.ts must not fetch (LLM/port are injected)");
  assert.ok(!src.includes("submitLog"), "agent.ts must not touch the test-disclosure lane");
  // names no PX HTTP endpoint (import paths like ../port/tools.ts are not endpoints)
  assert.ok(!src.includes("/port/mcp") && !src.includes("/api/"), "agent.ts names no PX endpoint");
});

// ── AG-6: classification + distill fail-closed ──────────────────────────────────

test("AG-6: tool sets partition; distill builder is fail-closed", () => {
  const names = agentTools().map((t) => t.name);
  assert.equal(names.length, 7, "6 port tools + remember_this");
  assert.ok(names.includes("read_candidates") && names.includes(REMEMBER_TOOL_NAME));
  assert.ok(isReadTool("read_candidates") && !isWriteTool("read_candidates"));
  assert.ok(isWriteTool("send_signal") && isWriteTool(REMEMBER_TOOL_NAME));
  assert.ok(!isReadTool("send_signal"));

  assert.equal(buildDistillRecord({ kind: "memory", text: "ok" }, "t", "m")?.body.text, "ok");
  assert.equal(buildDistillRecord({ kind: "bogus", text: "x" }, "t", "m"), null, "bad kind → null");
  assert.equal(buildDistillRecord({ kind: "have", text: "  " }, "t", "m"), null, "empty text → null");
});

// ── GT: generate tool-use pure mappers ─────────────────────────────────────────

test("GT-1: toAnthropicBody maps user/assistant-toolUse/tool-result + tools→input_schema", () => {
  const messages: AgentMessage[] = [
    { role: "user", text: "候補ある?" },
    { role: "assistant", text: "読みます", toolUses: [use("read_candidates")] },
    { role: "tool", results: [{ id: "tu_read_candidates", content: "{}", isError: false }] },
  ];
  const body = toAnthropicBody("claude-x", "SYS", messages, [
    { name: "read_candidates", description: "d", inputSchema: { type: "object" } },
  ]);
  assert.equal(body.system, "SYS");
  const msgs = body.messages as Array<Record<string, unknown>>;
  assert.equal(msgs[0].role, "user");
  const asst = msgs[1].content as Array<Record<string, unknown>>;
  assert.equal(asst[0].type, "text");
  assert.equal(asst[1].type, "tool_use");
  const toolMsg = msgs[2].content as Array<Record<string, unknown>>;
  assert.equal(toolMsg[0].type, "tool_result");
  assert.equal(toolMsg[0].tool_use_id, "tu_read_candidates");
  const tools = body.tools as Array<Record<string, unknown>>;
  assert.ok("input_schema" in tools[0], "anthropic uses input_schema");
});

test("GT-2: parseAnthropicTurn extracts text + tool_use; junk → empty", () => {
  const r = parseAnthropicTurn({
    content: [
      { type: "text", text: "読みますね。" },
      { type: "tool_use", id: "tu1", name: "read_inbox", input: { x: 1 } },
    ],
  });
  assert.equal(r.text, "読みますね。");
  assert.deepEqual(r.toolUses, [{ id: "tu1", name: "read_inbox", input: { x: 1 } }]);
  assert.deepEqual(parseAnthropicTurn("garbage"), { text: "", toolUses: [] });
});

test("GT-3: toOpenAIBody maps to system/tool_calls/tool role; parse handles broken args", () => {
  const messages: AgentMessage[] = [
    { role: "user", text: "hi" },
    { role: "assistant", text: "", toolUses: [use("place_question", { text: "x" })] },
    { role: "tool", results: [{ id: "tu_place_question", content: "{}" }] },
  ];
  const body = toOpenAIBody("gpt-x", "SYS", messages, [
    { name: "place_question", description: "d", inputSchema: { type: "object" } },
  ]);
  const msgs = body.messages as Array<Record<string, unknown>>;
  assert.equal(msgs[0].role, "system");
  assert.equal(msgs[2].role, "assistant");
  assert.ok(Array.isArray((msgs[2] as { tool_calls?: unknown }).tool_calls));
  assert.equal(msgs[3].role, "tool");
  assert.equal(msgs[3].tool_call_id, "tu_place_question");
  const tools = body.tools as Array<Record<string, unknown>>;
  assert.equal((tools[0] as { type: string }).type, "function");

  // broken arguments JSON → {} (fail-closed)
  const parsed = parseOpenAITurn({
    choices: [{ message: { content: "", tool_calls: [{ id: "c1", function: { name: "read_inbox", arguments: "{bad" } }] } }],
  });
  assert.deepEqual(parsed.toolUses, [{ id: "c1", name: "read_inbox", input: {} }]);
});

test("GT-4: generateTurn on ollama is unsupported (tool-use not driven locally)", async () => {
  const m = findModel("ollama:qwen2.5-coder:7b");
  const r = await generateTurn({ model: m, apiKey: "", endpoint: "", system: "", messages: [], tools: [] });
  assert.deepEqual(r, { ok: false, error: "unsupported" });
});

test("GT-5: generateTurn anthropic round-trips a tool_use (mocked fetch)", async () => {
  const realFetch = globalThis.fetch;
  try {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ content: [{ type: "tool_use", id: "x", name: "read_candidates", input: {} }] }))) as typeof fetch;
    const m = findModel("nonsense"); // catalog head — anthropic by default
    const r = await generateTurn({
      model: m.provider === "anthropic" ? m : { ...m, provider: "anthropic" },
      apiKey: "sk-ant-x",
      endpoint: "",
      system: "SYS",
      messages: [{ role: "user", text: "hi" }],
      tools: agentTools(),
    });
    assert.ok(r.ok && r.toolUses.length === 1 && r.toolUses[0].name === "read_candidates");
  } finally {
    globalThis.fetch = realFetch;
  }
});
