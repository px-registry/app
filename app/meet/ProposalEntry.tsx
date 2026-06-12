"use client";

// One received generation. Cards pass the PROVENANCE GATE before display
// (第3便 A): only a card whose addressee resolves to a real ownerRef of the
// pool sent at generation time renders as a proposal — an invented partner is
// excluded with an honest one-liner, and the verbatim raw reply stays
// inspectable in the fold for every entry. Readings auto-save (補遺 D): chips
// toggle-and-save on tap, the note saves on blur; the status line says
// honestly whether the test record was written.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { MEET } from "@/lib/meet/copy.ts";
import { gateCardsByProvenance, faceOfEntry } from "@/lib/meet-ai";
import type { ReceivedProposalV1, ReadingV1 } from "@/lib/meet-memory";
import { RIG_PRIVATE_ECHO_NOTE } from "@/lib/rig";
import { Ring } from "./Ring.tsx";

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}月${d.getDate()}日 ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function ReadingEditor({
  initial,
  onSave,
}: {
  initial: ReadingV1 | undefined;
  onSave: (r: ReadingV1) => Promise<boolean>;
}) {
  const [marks, setMarks] = useState<string[]>(initial?.marks ?? []);
  const [note, setNote] = useState(initial?.note ?? "");
  const [status, setStatus] = useState<"idle" | "saved" | "failed">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef({ marks, note });
  latest.current = { marks, note };
  const lastSaved = useRef(
    JSON.stringify({ marks: initial?.marks ?? [], note: (initial?.note ?? "").trim() }),
  );

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  // Debounced auto-save: rapid taps / tap+blur collapse into one write.
  const flush = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    const payload: ReadingV1 = { marks: latest.current.marks, note: latest.current.note.trim() };
    const key = JSON.stringify(payload);
    if (key === lastSaved.current) return; // nothing new to record
    lastSaved.current = key;
    void onSave(payload).then((ok) => {
      setStatus(ok ? "saved" : "failed");
      if (!ok) lastSaved.current = ""; // a later change may retry honestly
    });
  };
  const schedule = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, 500);
  };

  const toggle = (m: string) => {
    setMarks((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]));
    schedule();
  };

  // c16-2 テストの帯: eyebrow＋注記＋チップ＋ひとことを一つの視覚ユニットに——
  // これは計器であって製品の恒久機能ではない（research mode 日没の視覚的先行）。
  return (
    <div className="m-testband">
      <p className="m-eyebrow">{MEET.proposal.readings.eyebrow}</p>
      <p className="m-note" style={{ margin: "0.3rem 0 0.35rem" }}>
        {MEET.proposal.readings.note}
      </p>
      <div className="m-kindrow" style={{ marginBottom: "0.35rem" }}>
        {MEET.proposal.readings.options.map((m) => (
          <button
            key={m}
            type="button"
            className={`m-chip m-chip-pick ${marks.includes(m) ? "m-chip-active" : ""}`}
            onClick={() => toggle(m)}
            aria-pressed={marks.includes(m)}
          >
            {m}
          </button>
        ))}
      </div>
      <input
        className="m-field"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        onBlur={flush}
        placeholder={
          // c16-1b: わからない選択中は例示へ — 値も保存経路も変えない（placeholder のみ）
          marks.includes(MEET.proposal.readings.unknownChip)
            ? MEET.proposal.readings.notePlaceholderUnknown
            : MEET.proposal.readings.notePlaceholder
        }
      />
      {status !== "idle" && (
        <p
          className="m-note"
          aria-live="polite"
          style={status === "failed" ? { color: "var(--shu-deep)" } : undefined}
        >
          {status === "saved" ? MEET.proposal.readings.recorded : MEET.proposal.readings.recordFailed}
        </p>
      )}
    </div>
  );
}

export function ProposalEntry({
  entry,
  cardEdges,
  poolRefs,
  onTalk,
  onWithdraw,
  onReading,
  onRemove,
}: {
  entry: ReceivedProposalV1;
  /** R2 0010/便3: このカード（接点）の edge — キーは `${toRef}:${basisItemRef}`。
   *  live（sent/mutual）が勝ち、closed は「相手が sent 段階で止めた」場合だけ載る。 */
  cardEdges: ReadonlyMap<
    string,
    { edgeId: string; state: "sent" | "mutual" | "closed"; dormant: boolean }
  >;
  /** c18b: refs currently in the pool (the 気配 fetch); null = couldn't tell.
   *  Marking is advisory — c18's act-time check stays the second guard. */
  poolRefs: ReadonlySet<string> | null;
  /** c11/c13: the caller composes the recipient-addressed anchor from the
   *  card's lines (v3: 式 is line2; v2 stock: line1) and the addressee.
   *  c18: the send RESULT comes back — a refusal renders an honest line.
   *  R2 0010: the card's basis alias + an opaque pointer to THIS card ride
   *  along — they become the edge's basis_item_ref / proposal_ptr. */
  onTalk: (
    toRef: string,
    basisItemRef: string,
    proposalPtr: string,
    line1: string,
    line2: string,
    to: string,
  ) => Promise<{ ok: boolean; code: string }>;
  /** 便3 T3 — a の取り下げ（sent の edge にだけ出る）。 */
  onWithdraw: (edgeId: string) => Promise<{ ok: boolean; code: string }>;
  onReading: (entryId: string, cardIndex: number, reading: ReadingV1) => Promise<boolean>;
  onRemove: (entryId: string) => Promise<void>;
}) {
  // c18 — 沈黙の禁止: the outcome of pressing 話してみる lands on THIS card.
  // Keyed by card index; "" = cleared (a later success wipes an old line).
  const [talkNotes, setTalkNotes] = useState<Record<number, string>>({});
  // 第7便 C: with a basis map (new entries), a card must also point at a real
  // served item OF ITS ADDRESSEE; pre-第7便 entries keep the to-only gate.
  const { kept, excluded } = gateCardsByProvenance(entry.cards, entry.refs, entry.basisItems);
  // 第8便 B + 第9便 A — 沈黙の禁止: the pinned decision table picks the
  // entry's face; every run renders as cards, 今日は無い, the verbatim raw,
  // a pool-empty fact, or an honest error. Never nothing.
  const face = faceOfEntry(entry);

  const rawFold = (
    <details className="m-rawfold">
      <summary>{MEET.home.proposals.rawShow}</summary>
      <p className="m-item-text" style={{ whiteSpace: "pre-wrap" }}>
        {entry.raw}
      </p>
    </details>
  );

  return (
    <li className="m-entry">
      <div className="m-entry-meta">
        <span className="m-entry-when">{fmtDate(entry.createdAt)}</span>
        <span>
          {entry.modelLabel !== ""
            ? MEET.home.proposals.modelNote(entry.modelLabel)
            : MEET.home.proposals.manualLabel}
          {entry.question !== "" && <>（{entry.question}）</>}
        </span>
        {entry.via === "patrol" && (
          // 見回り provenance — which placed question this quiet run served
          <span className="m-entry-pill">
            {MEET.home.proposals.patrolLabel(entry.patrolQuestion ?? "")}
          </span>
        )}
      </div>
      <div className="m-entry-inner">
        {entry.echoFlag && (
          <p className="m-warnings" style={{ margin: "0 0 0.5rem" }}>
            {RIG_PRIVATE_ECHO_NOTE}
          </p>
        )}
        {face === "pool-empty" ? (
          // 第9便 A/D: the short-circuit is a dated entry now, not a side note
          <p className="m-item-text">
            {MEET.home.proposals.noneToday} {MEET.receive.poolEmptyNote}
          </p>
        ) : face === "error" ? (
          <p className="m-item-text" aria-live="polite" style={{ color: "var(--shu-deep)" }}>
            {MEET.receive.errors[entry.errorCode ?? "unknown"] ?? MEET.receive.errors.unknown}
          </p>
        ) : face === "raw" ? (
          // a true format miss — the verbatim reply IS the honest body
          <p className="m-item-text" style={{ whiteSpace: "pre-wrap" }}>
            {entry.raw}
          </p>
        ) : (
          <div style={{ display: "grid", gap: "1.2rem" }}>
            {face === "none-today" && (
              <p className="m-item-text">{MEET.home.proposals.noneToday}</p>
            )}
            {kept.map(({ card, index }) => {
              const toRef = entry.refs[card.to]; // non-empty — the gate's invariant
              const partnerIntro = (entry.intros?.[card.to] ?? "").trim();
              const basisItem = entry.basisItems?.[card.basisItemId];
              // R2 0010: the edge this card would open — sent は接点単位。
              // pre-R2 entries ("" alias) never match a key; their act fails
              // honestly at the server (basis_not_in_pool).
              const basisRef = basisItem?.itemRef ?? "";
              const edge = cardEdges.get(`${toRef}:${basisRef}`);
              const sent = edge !== undefined && edge.state !== "closed";
              // 便3: 相手が sent 段階で止めた接点 — 一語の事実（語り分けない）。
              const stopped = edge !== undefined && edge.state === "closed";
              // c18b 受動マーキング: 押す前から無いと分かる。確信があるとき
              // だけ（pool照合不能=null では偽の不在も嘘なのでマークしない）。
              const absent = poolRefs !== null && !poolRefs.has(toRef);
              return (
                <div key={index}>
                  <div className="m-cardhead">
                    {/* c9-5: 印なしの輪は状態記号サイズ=22。印あり=44 は R2 用の規約
                        （G-1=B: 今回の配布に印データは存在しない＝常に小輪） */}
                    <Ring state="sent" size={22} />
                    <h3>{card.to}</h3>
                    {sent && <span className="m-statechip">{MEET.proposal.talkSent}</span>}
                    {edge !== undefined && edge.state === "sent" && (
                      // 便3 T3 — 取り下げる: sent のあいだだけ（mutual は pair 面で閉じる）
                      <button
                        type="button"
                        className="m-link"
                        onClick={() =>
                          void onWithdraw(edge.edgeId).then((r) =>
                            setTalkNotes((prev) => ({ ...prev, [index]: r.ok ? "" : r.code })),
                          )
                        }
                      >
                        {MEET.home.edge.withdraw}
                      </button>
                    )}
                  </div>
                  {stopped && (
                    // 便3 — 相手が止めた事実の一語（終わり方を語り分けない）。
                    // ボタンは下に残る: 再び押すのは新しい edge（T6）。
                    <p className="m-note" aria-live="polite" style={{ margin: "0.3rem 0 0" }}>
                      {MEET.home.edge.stopped}
                    </p>
                  )}
                  {edge !== undefined && edge.dormant && edge.state !== "closed" && (
                    // 便3 — dormant は読み時導出の事実（状態ではない）
                    <p className="m-note" style={{ margin: "0.3rem 0 0" }}>
                      {MEET.home.edge.dormant}
                    </p>
                  )}
                  {absent && (
                    // c18b/c18c: the same line c18 answers with, BEFORE any
                    // press — and directly under the sent chip too (a sent
                    // card must not look alive-and-waiting; 同一定数のみ).
                    // 箒は既存「この回を消す」のまま（新設なし）。
                    <p className="m-note" aria-live="polite" style={{ margin: "0.3rem 0 0" }}>
                      {MEET.home.signals.notInPool}
                    </p>
                  )}
                  {partnerIntro !== "" && (
                    <p className="m-item-tags" style={{ margin: "0.3rem 0 0" }}>
                      {card.to}——{partnerIntro}
                    </p>
                  )}
                  {/* 提案本文 — rule9（3行）エンジンの出力をそのまま（行数を加工しない） */}
                  <div className="m-entry-body">
                    <p style={{ margin: 0 }}>{card.line1}</p>
                    {card.line2 && <p style={{ margin: 0 }}>{card.line2}</p>}
                    {card.line3 && <p style={{ margin: 0 }}>{card.line3}</p>}
                  </div>
                  {basisItem !== undefined && (
                    // 第7便 D: exactly ONE grounding item — never the partner's
                    // whole list (the AI-only pool stays human-unbrowsable).
                    <details className="m-basis">
                      <summary>{MEET.proposal.basisShow}</summary>
                      {basisItem.business === true && (
                        // 0012 表示点: 立てられた旗の一語（事実の転載・判定なし）
                        <p className="m-item-tags" style={{ margin: "0.3rem 0 0" }}>
                          {MEET.home.place.business}
                        </p>
                      )}
                      <p className="m-item-text">
                        {basisItem.title.trim() !== ""
                          ? `${basisItem.title} — ${basisItem.text}`
                          : basisItem.text}
                      </p>
                    </details>
                  )}
                  {!sent && (
                    <button
                      type="button"
                      className={`m-btn m-proposal-talk ${absent ? "m-btn-quiet m-btn-dim" : "m-btn-primary"}`}
                      style={{ marginTop: "0.7rem" }}
                      onClick={() =>
                        void onTalk(
                          toRef,
                          basisRef,
                          `${entry.entryId}#${index}`,
                          card.line1,
                          card.line2,
                          card.to,
                        ).then((r) =>
                          setTalkNotes((prev) => ({ ...prev, [index]: r.ok ? "" : r.code })),
                        )
                      }
                    >
                      {MEET.proposal.talk}
                    </button>
                  )}
                  {(talkNotes[index] ?? "") !== "" && (
                    // c18: refusal lines — dead edge / missing name / honest error.
                    // The button stays above (再試行可); sent never flips here.
                    <p className="m-note" aria-live="polite" style={{ color: "var(--shu-deep)" }}>
                      {talkNotes[index] === "peer_not_in_pool" ||
                      talkNotes[index] === "basis_not_in_pool" ? (
                        // R2 0010: 根拠項目の取り下げも「もう卓にない」と同じ
                        // 事実 — 同一定数（新文言なし）
                        MEET.home.signals.notInPool
                      ) : talkNotes[index] === "from_name" ? (
                        <>
                          {MEET.home.signals.nameFirst}{" "}
                          <Link className="m-rowlink" href="/meet/memory/#name">
                            {MEET.receive.nameWhere}
                          </Link>
                          。
                        </>
                      ) : (
                        MEET.receive.errors[talkNotes[index]] ?? MEET.receive.errors.unknown
                      )}
                    </p>
                  )}
                  <ReadingEditor
                    initial={entry.readings[index]}
                    onSave={(r) => onReading(entry.entryId, index, r)}
                  />
                </div>
              );
            })}
            {excluded.length > 0 && (
              <p className="m-note" style={{ margin: 0 }}>
                {MEET.home.proposals.provenanceNote(excluded.length)}
              </p>
            )}
          </div>
        )}
        <div className="m-foot-row">
          {face !== "raw" && face !== "pool-empty" && face !== "error" && rawFold}
          <button type="button" className="m-link" onClick={() => void onRemove(entry.entryId)}>
            {MEET.home.proposals.removeEntry}
          </button>
        </div>
      </div>
    </li>
  );
}
