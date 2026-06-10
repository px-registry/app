"use client";

// One received generation: its cards (each with 話してみる + 読み), the echo
// warning, the verbatim raw fallback. Signals go to the participantRef captured
// at generation time; a card whose counterpart can't be resolved says so and
// offers no button (fail-closed targeting, fail-open display).

import { useState } from "react";
import { MEET } from "@/lib/meet/copy.ts";
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
  onSave: (r: ReadingV1) => Promise<void>;
}) {
  const [marks, setMarks] = useState<string[]>(initial?.marks ?? []);
  const [note, setNote] = useState(initial?.note ?? "");
  const [saved, setSaved] = useState(false);

  const toggle = (m: string) => {
    setMarks((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]));
    setSaved(false);
  };

  return (
    <div style={{ marginTop: "0.5rem" }}>
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
      <div style={{ display: "flex", gap: "0.4rem" }}>
        <input
          className="m-field"
          value={note}
          onChange={(e) => {
            setNote(e.target.value);
            setSaved(false);
          }}
          placeholder={MEET.proposal.readings.notePlaceholder}
        />
        <button
          type="button"
          className="m-btn m-btn-quiet"
          onClick={() => {
            void onSave({ marks, note: note.trim() }).then(() => setSaved(true));
          }}
        >
          {saved ? MEET.proposal.readings.saved : MEET.proposal.readings.save}
        </button>
      </div>
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
  onReading: (entryId: string, cardIndex: number, reading: ReadingV1) => Promise<void>;
  onRemove: (entryId: string) => Promise<void>;
}) {
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
      {entry.cards.length === 0 ? (
        <p className="m-item-text" style={{ whiteSpace: "pre-wrap" }}>
          {entry.raw.trim() === "[]" ? MEET.home.proposals.noneToday : entry.raw}
        </p>
      ) : (
        <div style={{ display: "grid", gap: "0.9rem" }}>
          {entry.cards.map((card, i) => {
            const toRef = entry.refs[card.to] ?? "";
            const sent = toRef !== "" && sentRefs.has(toRef);
            return (
              <div key={i} className="m-proposal">
                <p className="m-item-title" style={{ margin: 0 }}>
                  {card.to}
                </p>
                <p className="m-item-text">{card.line1}</p>
                {card.line2 && <p className="m-item-text">{card.line2}</p>}
                {toRef === "" ? (
                  <p className="m-note">{MEET.proposal.noTarget}</p>
                ) : (
                  <button
                    type="button"
                    className={`m-btn ${sent ? "m-btn-quiet" : "m-btn-primary"}`}
                    style={{ marginTop: "0.45rem" }}
                    disabled={sent}
                    onClick={() => void onTalk(toRef, card.line1.slice(0, 80))}
                  >
                    {sent ? MEET.proposal.talkSent : MEET.proposal.talk}
                  </button>
                )}
                <ReadingEditor
                  initial={entry.readings[i]}
                  onSave={(r) => onReading(entry.entryId, i, r)}
                />
              </div>
            );
          })}
          <details>
            <summary className="m-note" style={{ cursor: "pointer" }}>
              {MEET.home.proposals.rawShow}
            </summary>
            <p className="m-item-text" style={{ whiteSpace: "pre-wrap" }}>
              {entry.raw}
            </p>
          </details>
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
