"use client";

// One received generation. Cards pass the PROVENANCE GATE before display
// (第3便 A): only a card whose addressee resolves to a real ownerRef of the
// pool sent at generation time renders as a proposal — an invented partner is
// excluded with an honest one-liner, and the verbatim raw reply stays
// inspectable in the fold for every entry. Readings auto-save (補遺 D): chips
// toggle-and-save on tap, the note saves on blur; the status line says
// honestly whether the test record was written.

import { useEffect, useRef, useState } from "react";
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

  return (
    <div style={{ marginTop: "0.5rem" }}>
      <p className="m-note" style={{ margin: "0 0 0.35rem" }}>
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
        placeholder={MEET.proposal.readings.notePlaceholder}
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
  sentRefs,
  onTalk,
  onReading,
  onRemove,
}: {
  entry: ReceivedProposalV1;
  /** refs this owner has already signalled (from the inbox outgoing list). */
  sentRefs: ReadonlySet<string>;
  onTalk: (toRef: string, anchor: string) => Promise<void>;
  onReading: (entryId: string, cardIndex: number, reading: ReadingV1) => Promise<boolean>;
  onRemove: (entryId: string) => Promise<void>;
}) {
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
              const sent = sentRefs.has(toRef);
              const partnerIntro = (entry.intros?.[card.to] ?? "").trim();
              const basisItem = entry.basisItems?.[card.basisItemId];
              return (
                <div key={index}>
                  <div className="m-cardhead">
                    {/* 印データは存在しない（G-1=B）— 輪のみ */}
                    <Ring state="sent" size={44} />
                    <h3>{card.to}</h3>
                    {sent && <span className="m-statechip">{MEET.proposal.talkSent}</span>}
                  </div>
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
                      className="m-btn m-btn-primary m-proposal-talk"
                      style={{ marginTop: "0.7rem" }}
                      onClick={() => void onTalk(toRef, card.line1.slice(0, 80))}
                    >
                      {MEET.proposal.talk}
                    </button>
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
