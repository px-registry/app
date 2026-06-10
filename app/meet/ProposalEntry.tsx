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
import { gateCardsByProvenance, entryFace } from "@/lib/meet-ai";
import type { ReceivedProposalV1, ReadingV1 } from "@/lib/meet-memory";
import { RIG_PRIVATE_ECHO_NOTE } from "@/lib/rig";

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
  // 第8便 B — 沈黙の禁止: the pinned decision table picks the entry's face;
  // every generation renders as cards, 今日は無い, or the verbatim raw.
  const face = entryFace(entry.raw, entry.cards, entry.refs, entry.basisItems);

  const rawFold = (
    <details>
      <summary className="m-note" style={{ cursor: "pointer" }}>
        {MEET.home.proposals.rawShow}
      </summary>
      <p className="m-item-text" style={{ whiteSpace: "pre-wrap" }}>
        {entry.raw}
      </p>
    </details>
  );

  return (
    <li className="m-item">
      <p className="m-item-tags" style={{ margin: "0 0 0.4rem" }}>
        {fmtDate(entry.createdAt)} ・ {MEET.home.proposals.modelNote(entry.modelLabel)}
        {entry.question !== "" && <>（{entry.question}）</>}
      </p>
      {entry.echoFlag && (
        <p className="m-warnings" style={{ margin: "0 0 0.5rem" }}>
          {RIG_PRIVATE_ECHO_NOTE}
        </p>
      )}
      {face === "raw" ? (
        // a true format miss — the verbatim reply IS the honest body
        <p className="m-item-text" style={{ whiteSpace: "pre-wrap" }}>
          {entry.raw}
        </p>
      ) : (
        <div style={{ display: "grid", gap: "0.9rem" }}>
          {face === "none-today" && (
            <p className="m-item-text">{MEET.home.proposals.noneToday}</p>
          )}
          {kept.map(({ card, index }) => {
            const toRef = entry.refs[card.to]; // non-empty — the gate's invariant
            const sent = sentRefs.has(toRef);
            const partnerIntro = (entry.intros?.[card.to] ?? "").trim();
            const basisItem = entry.basisItems?.[card.basisItemId];
            return (
              <div key={index} className="m-proposal">
                <p className="m-item-title" style={{ margin: 0 }}>
                  {card.to}
                </p>
                {partnerIntro !== "" && (
                  <p className="m-item-tags" style={{ margin: "0.1rem 0 0" }}>
                    {card.to}——{partnerIntro}
                  </p>
                )}
                <p className="m-item-text">{card.line1}</p>
                {card.line2 && <p className="m-item-text">{card.line2}</p>}
                {basisItem !== undefined && (
                  // 第7便 D: exactly ONE grounding item — never the partner's
                  // whole list (the AI-only pool stays human-unbrowsable).
                  <details style={{ marginTop: "0.3rem" }}>
                    <summary className="m-note" style={{ cursor: "pointer" }}>
                      {MEET.proposal.basisShow}
                    </summary>
                    <p className="m-item-text">
                      {basisItem.title.trim() !== ""
                        ? `${basisItem.title} — ${basisItem.text}`
                        : basisItem.text}
                    </p>
                  </details>
                )}
                <button
                  type="button"
                  className={`m-btn ${sent ? "m-btn-quiet" : "m-btn-primary"}`}
                  style={{ marginTop: "0.45rem" }}
                  disabled={sent}
                  onClick={() => void onTalk(toRef, card.line1.slice(0, 80))}
                >
                  {sent ? MEET.proposal.talkSent : MEET.proposal.talk}
                </button>
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
          {rawFold}
        </div>
      )}
      <div className="m-item-actions">
        <button type="button" className="m-link" onClick={() => void onRemove(entry.entryId)}>
          {MEET.home.proposals.removeEntry}
        </button>
      </div>
    </li>
  );
}
