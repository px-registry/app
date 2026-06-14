// 記憶装置 層2 — 常駐の自由会話窓の agent loop（設計正本 v0.7 §0.5/§12）。
//
// 窓の向こうは **本物の owner の AI**（鍵は owner・PX 非中継）。この loop は PURE な
// オーケストレータ: fetch を持たない（LLM 往復・道具実行・owner 確認・記憶 append は
// すべて注入される）。だから lib/meet-ai のレーン規律（fetch=generate.ts のみ）を
// 破らず、テストは fake で全経路を踏める。
//
// 道具の二態（§12 Tool Contract・lock）:
//   * read 系（自動）  : get_law / read_candidates / read_inbox — ループ内で自動実行。
//   * write 系（二態）  : place_question / send_signal / draft_talk_link — 実行前に
//                        必ず owner 確認カード（confirmWrite）。✅ で初めて実行。
//   * 蒸留（write 系）  : remember_this — 会話から記憶へ。owner ✅ で journal に append
//                        （content record・sourceRef channel="talk"）。
//
// 沈黙の禁止: owner が断った write も「断った」という結果を tool_result に返す
// （会話が無言で途切れない）。fail-closed: 確認なしに外へ出ない・書かない。
//
// no-log: この loop は会話本文を PX へ出さない（fetch を一切持たない）。道具の実行で
// network に出るのは「owner が UI でやる操作と同一の typed payload」だけ（注入された
// portCall の責務・meet-net portCall がその唯一の口）。

import {
  type ToolSpec,
  type ToolUse,
  type ToolResult,
  type AgentMessage,
  type TurnResult,
} from "./generate.ts";
import { PORT_TOOLS, PORT_READ_TOOLS, PORT_WRITE_TOOLS } from "../port/tools.ts";
import type { NewContentRecordV1 } from "../meet-memory/journal-types.ts";
import type { RigMemoryKindV1 } from "../rig/rig.ts";

export type { AgentMessage } from "./generate.ts";

/** 蒸留の道具（PX の port には無い・窓のローカル道具）。owner ✅ で journal へ。 */
export const REMEMBER_TOOL_NAME = "remember_this";

export const REMEMBER_TOOL: ToolSpec = {
  name: REMEMBER_TOOL_NAME,
  description:
    "今の会話の中に出てきた事実を、owner の記憶に書き留める候補として差し出す。owner の確認の後にだけ書かれる。判定でなく、見つかった事実をそのまま残す。",
  inputSchema: {
    type: "object",
    properties: {
      kind: { type: "string", enum: ["have", "want", "avoid", "memory"], description: "事実の種類。" },
      title: { type: "string", description: "省略可 — 一言の見出し。" },
      text: { type: "string", description: "記憶の本文（生のまま・盛らない）。" },
      tags: { type: "array", items: { type: "string" }, description: "省略可 — 後で読み返す手がかりの語。" },
    },
    required: ["kind", "text"],
    additionalProperties: false,
  },
};

const READ_SET = new Set<string>(PORT_READ_TOOLS);
const WRITE_SET = new Set<string>([...PORT_WRITE_TOOLS, REMEMBER_TOOL_NAME]);
const RIG_KINDS = new Set<string>(["have", "want", "avoid", "memory"]);

/** 窓がモデルに渡す道具一式 = port 六道具 ＋ ローカルの蒸留道具。 */
export function agentTools(): ToolSpec[] {
  return [
    ...PORT_TOOLS.map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema })),
    REMEMBER_TOOL,
  ];
}

export function isReadTool(name: string): boolean {
  return READ_SET.has(name);
}
export function isWriteTool(name: string): boolean {
  return WRITE_SET.has(name);
}

/**
 * 蒸留の input → journal の content record（sourceRef channel="talk"）。private 既定
 * （fail-closed: 会話由来の事実は明示で公開しない限り private）。provenance は owner
 * 確認を経るので owner_written。
 */
export function buildDistillRecord(
  input: Record<string, unknown>,
  threadRef: string,
  messageRef: string,
): NewContentRecordV1 | null {
  const kind = typeof input.kind === "string" && RIG_KINDS.has(input.kind) ? (input.kind as RigMemoryKindV1) : null;
  const text = typeof input.text === "string" ? input.text.trim() : "";
  if (kind === null || text === "") return null; // fail-closed: 形が崩れていれば書かない
  const title = typeof input.title === "string" ? input.title : "";
  const tags = Array.isArray(input.tags) ? input.tags.filter((t): t is string => typeof t === "string") : [];
  return {
    contentKind: "rig_item",
    provenance: "owner_written",
    sourceRef: { channel: "talk", threadRef, messageRef },
    body: { kind, title, text, tags, private: true },
  };
}

export type AgentDeps = {
  /** LLM 一手（generate.ts の generateTurn を窓が注入）。 */
  llm: (system: string, messages: AgentMessage[], tools: ToolSpec[]) => Promise<TurnResult>;
  /** port 道具の実行（meet-net portCall を窓が注入）。read と、✅ 済 write が通る。 */
  portCall: (name: string, args: Record<string, unknown>) => Promise<{ content: string; isError: boolean }>;
  /** write 系の二態確認カード（owner ✅ = true）。read 系では呼ばれない。 */
  confirmWrite: (req: { name: string; input: Record<string, unknown> }) => Promise<boolean>;
  /** 蒸留の append（journal store を窓が注入）。owner ✅ の後だけ呼ばれる。 */
  appendMemory: (record: NewContentRecordV1) => Promise<void>;
};

export type AgentTurnOpts = {
  /** 蒸留の sourceRef に焼く会話スレッド参照。 */
  threadRef?: string;
  /** tool ループの上限（暴走止め）。 */
  maxSteps?: number;
};

const READ_ERROR_RESULT = (id: string): ToolResult => ({
  id,
  content: JSON.stringify({ ok: false, error: "unknown_tool" }),
  isError: true,
});

function declinedResult(id: string): ToolResult {
  // 沈黙の禁止: 断りも「断った」という結果として会話に残す。
  return { id, content: JSON.stringify({ ok: false, declined: true, note: "owner が今回は見送りました。" }) };
}

/** 一つの tool_use を結果へ。read=自動 / write=二態確認 / remember=蒸留。 */
async function executeToolUse(
  deps: AgentDeps,
  use: ToolUse,
  threadRef: string,
  messageRef: string,
): Promise<ToolResult> {
  if (isReadTool(use.name)) {
    const r = await deps.portCall(use.name, use.input);
    return { id: use.id, content: r.content, isError: r.isError };
  }
  if (use.name === REMEMBER_TOOL_NAME) {
    const ok = await deps.confirmWrite({ name: use.name, input: use.input });
    if (!ok) return declinedResult(use.id);
    const record = buildDistillRecord(use.input, threadRef, messageRef);
    if (record === null) {
      return { id: use.id, content: JSON.stringify({ ok: false, error: "bad_record" }), isError: true };
    }
    await deps.appendMemory(record);
    return { id: use.id, content: JSON.stringify({ ok: true, remembered: true }) };
  }
  if (WRITE_SET.has(use.name)) {
    const ok = await deps.confirmWrite({ name: use.name, input: use.input });
    if (!ok) return declinedResult(use.id);
    const r = await deps.portCall(use.name, use.input);
    return { id: use.id, content: r.content, isError: r.isError };
  }
  return READ_ERROR_RESULT(use.id);
}

const ERROR_TEXT: Record<string, string> = {
  auth: "AIの鍵が通りませんでした。設定を確かめてください。",
  rate: "AIが混み合っています。少し置いてからもう一度。",
  provider: "AIからの返事を受け取れませんでした。",
  network: "AIにつながりませんでした。",
  unsupported: "この窓は anthropic か openai の鍵で動きます（ローカルAIは道具に未対応）。",
};

/**
 * 一往復のターンを回す。owner の発話を受けて、モデルが道具を呼べば read は自動、
 * write は confirmWrite を経て実行し、結果を戻してモデルを再度回す — 道具呼び出しが
 * 尽きるまで（or maxSteps）。返り値は更新後の messages（窓はこれを描く）。
 *
 * 沈黙の禁止: LLM 失敗時も assistant の正直な一行を残して返す（無言で終わらない）。
 */
export async function runAgentTurn(
  deps: AgentDeps,
  system: string,
  messages: AgentMessage[],
  opts?: AgentTurnOpts,
): Promise<AgentMessage[]> {
  const threadRef = opts?.threadRef ?? "";
  const maxSteps = opts?.maxSteps ?? 8;
  const convo = [...messages];

  for (let step = 0; step < maxSteps; step++) {
    const turn = await deps.llm(system, convo, agentTools());
    if (!turn.ok) {
      convo.push({ role: "assistant", text: ERROR_TEXT[turn.error] ?? "うまくいきませんでした。", toolUses: [] });
      return convo;
    }
    convo.push({ role: "assistant", text: turn.text, toolUses: turn.toolUses });
    if (turn.toolUses.length === 0) return convo; // 最終の発話 — 道具呼びなし

    const results: ToolResult[] = [];
    for (let i = 0; i < turn.toolUses.length; i++) {
      results.push(await executeToolUse(deps, turn.toolUses[i], threadRef, `${step}-${i}`));
    }
    convo.push({ role: "tool", results });
  }
  // maxSteps 到達 — 暴走止め（正直に一行）。
  convo.push({ role: "assistant", text: "（道具の往復が続いたのでいったん止めました。）", toolUses: [] });
  return convo;
}
