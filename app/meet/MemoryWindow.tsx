"use client";

// 記憶装置 層2(b) — 常駐の自由会話窓「あなたのAI」（設計正本 v0.7 §0.5）。
//
// 窓の向こうは本物の owner の AI（鍵は owner・PX 非中継）。owner は記憶を「さがす・
// 置いておく・整えてもらう」を言葉で握る。機能ボタンの集まりではなく、会話窓ひとつ。
//
// no-log: 会話本文は PX へ出ない。窓が呼ぶのは (a) generateTurn（owner の鍵で provider
// 直）と (b) meet-net portCall（/port/mcp に tool 名＋typed args だけ）。submitLog にも
// /api/meet にも message を出さない。
//
// 二態（§12・(a) AG-1 を UI 層でも保つ）: read は自動 / write（place_question・
// send_signal・draft_talk_link）と蒸留 remember_this は確認カード（confirmWrite）を
// 経て初めて実行。沈黙の禁止: 断りも会話に declined として残る（agent.ts が返す）。
//
// 会話履歴: ③蒸留が既定（生 chat は state のみ・リロードで揮発）。②「続きを端末に
// 残す」ON の時だけ端末 IndexedDB に控える（PX 非送信）。OFF で控えは消える。
//
// 圧の語彙なし: 既読・presence・入力中・未読バッジはこの窓に存在しない（meet トーク
// 面と同じ構え・spec §10）。

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MEET } from "@/lib/meet/copy.ts";
import {
  buildAgentSystem,
  renderMemoryContext,
  runAgentTurn,
  REMEMBER_TOOL_NAME,
  generateTurn,
  getModel,
  getKey,
  getEndpoint,
  isConnected,
  type AgentMessage,
  type AgentDeps,
} from "@/lib/meet-ai";
import { FocusScope } from "@react-aria/focus";
import { PORT_TOOLS } from "@/lib/port/tools.ts";
import {
  getOrMintOwnerToken,
  portCall,
  getWindowPersist,
  setWindowPersist,
} from "@/lib/meet-net";
import { openMemJournal, openWindowChat } from "@/lib/meet-memory";

const C = MEET.home.aiWindow;

/** 道具ごとの行為語 — すべて既存ゲート済を流用（新しい確認カード語は作らない）。 */
function approveLabel(name: string): string {
  if (name === "place_question") return MEET.home.place.confirm;
  if (name === "send_signal") return MEET.proposal.talk;
  if (name === "draft_talk_link") return MEET.home.dock.draftAsk;
  return C.distillGo;
}
function declineLabel(name: string): string {
  return name === REMEMBER_TOOL_NAME ? C.distillSkip : MEET.home.place.cancel;
}
function toolDescription(name: string): string {
  return PORT_TOOLS.find((t) => t.name === name)?.description ?? "";
}

type Pending = { name: string; input: Record<string, unknown>; resolve: (ok: boolean) => void };

export function MemoryWindow() {
  const journal = useMemo(() => openMemJournal(), []);
  const chat = useMemo(() => openWindowChat(), []);
  const threadRef = useRef<string>("");

  const [open, setOpen] = useState(false);
  const [connected, setConnected] = useState(false);
  const [persist, setPersist] = useState(false);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  // 確認カード（§12 二態）の a11y: 出たら容器へフォーカスを移す（approve ボタンには
  // 寄せない — 不用意な Enter で承認しないため）。FocusScope が Tab を閉じ込め、
  // Escape は declined（沈黙の禁止: 断りも結果として会話に残る）、閉じると元へ復帰。
  const confirmRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (pending !== null) confirmRef.current?.focus();
  }, [pending]);

  // localStorage / IndexedDB は effect で初期化（prerender を落とさない）。
  useEffect(() => {
    setConnected(isConnected());
    const on = getWindowPersist();
    setPersist(on);
    if (threadRef.current === "") {
      const b = crypto.getRandomValues(new Uint8Array(8));
      threadRef.current = `win_${[...b].map((x) => x.toString(16).padStart(2, "0")).join("")}`;
    }
    if (on) void chat.load().then((m) => setMessages(m as AgentMessage[]));
  }, [chat]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, pending]);

  const togglePersist = useCallback(
    async (on: boolean) => {
      setWindowPersist(on);
      setPersist(on);
      if (on) await chat.save(messages);
      else await chat.clear(); // OFF＝控えを捨て、生 chat 揮発の既定へ戻る
    },
    [chat, messages],
  );

  const send = useCallback(async () => {
    const text = input.trim();
    if (text === "" || busy) return;
    setBusy(true);
    setInput("");
    const base: AgentMessage[] = [...messages, { role: "user", text }];
    setMessages(base);

    const records = await journal.list();
    const system = buildAgentSystem(renderMemoryContext(records, text));

    const deps: AgentDeps = {
      llm: (sys, msgs, tools) => {
        const model = getModel();
        return generateTurn({
          model,
          apiKey: model.provider === "ollama" ? "" : getKey(model.provider),
          endpoint: getEndpoint(),
          system: sys,
          messages: msgs,
          tools,
        });
      },
      portCall: async (name, args) => {
        const r = await portCall({ ownerToken: getOrMintOwnerToken(), name, args });
        return r.ok
          ? { content: r.content, isError: r.isError }
          : { content: JSON.stringify({ ok: false, error: r.error }), isError: true };
      },
      // 二態: write/蒸留 は必ずこのカードを経る（owner ✅ のみ true）。
      confirmWrite: (req) =>
        new Promise<boolean>((resolve) => {
          setPending({
            name: req.name,
            input: req.input,
            resolve: (ok) => {
              setPending(null);
              resolve(ok);
            },
          });
        }),
      appendMemory: (rec) => journal.append(rec).then(() => undefined),
    };

    try {
      const updated = await runAgentTurn(deps, system, base, { threadRef: threadRef.current });
      setMessages(updated);
      if (getWindowPersist()) await chat.save(updated);
    } finally {
      setBusy(false);
    }
  }, [input, busy, messages, journal, chat]);

  // ── 描画 ───────────────────────────────────────────────────────────────────

  if (!open) {
    return (
      <button type="button" className="m-aiwin-fab" onClick={() => setOpen(true)} aria-label={C.open}>
        {C.title}
      </button>
    );
  }

  return (
    <section className="m-aiwin" aria-label={C.title}>
      <header className="m-aiwin-head">
        <span className="m-aiwin-name">{C.title}</span>
        <button type="button" className="m-aiwin-min" onClick={() => setOpen(false)} aria-label={C.minimize}>
          —
        </button>
      </header>

      <div className="m-aiwin-log" ref={scrollRef}>
        {messages.length === 0 && <p className="m-aiwin-intro">{C.intro}</p>}
        {messages.map((m, i) => {
          if (m.role === "user") {
            return (
              <p key={i} className="m-aiwin-msg is-owner">
                {m.text}
              </p>
            );
          }
          if (m.role === "assistant" && m.text.trim() !== "") {
            return (
              <p key={i} className="m-aiwin-msg is-ai">
                {m.text}
              </p>
            );
          }
          return null; // tool 往復は内部 — owner には assistant の言葉で返る
        })}

        {pending !== null && (
          <FocusScope contain restoreFocus>
          <div
            ref={confirmRef}
            tabIndex={-1}
            className="m-aiwin-confirm"
            role="dialog"
            aria-modal="true"
            aria-label={C.confirmLead}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.stopPropagation();
                pending.resolve(false);
              }
            }}
          >
            {pending.name === REMEMBER_TOOL_NAME ? (
              <>
                <p className="m-aiwin-confirm-lead">{C.distillAsk}</p>
                {typeof pending.input.text === "string" && (
                  <p className="m-aiwin-confirm-body">{pending.input.text}</p>
                )}
              </>
            ) : (
              <>
                <p className="m-aiwin-confirm-lead">{C.confirmLead}</p>
                <p className="m-aiwin-confirm-body">{toolDescription(pending.name)}</p>
              </>
            )}
            <div className="m-aiwin-confirm-row">
              <button type="button" className="m-btn m-btn-primary" onClick={() => pending.resolve(true)}>
                {approveLabel(pending.name)}
              </button>
              <button type="button" className="m-btn m-btn-quiet" onClick={() => pending.resolve(false)}>
                {declineLabel(pending.name)}
              </button>
            </div>
          </div>
          </FocusScope>
        )}
      </div>

      {connected ? (
        <div className="m-aiwin-foot">
          <textarea
            className="m-field m-aiwin-input"
            rows={2}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={C.placeholder}
            disabled={busy}
          />
          <button
            type="button"
            className="m-btn m-btn-primary"
            disabled={input.trim() === "" || busy}
            onClick={() => void send()}
          >
            {MEET.home.talk.send}
          </button>
          <label className="m-aiwin-persist">
            <input type="checkbox" checked={persist} onChange={(e) => void togglePersist(e.target.checked)} />
            <span>{C.persistToggle}</span>
            <span className="m-note m-aiwin-persist-note">{C.persistNote}</span>
          </label>
        </div>
      ) : (
        <p className="m-note m-aiwin-offline">{C.offline}</p>
      )}
    </section>
  );
}
