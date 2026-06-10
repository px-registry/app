"use client";

// 合図 — signals addressed to me. One-sided by design: the sender moved first;
// I can move too (こちらも話してみる). When mutual, the contact-note exchange
// opens — my note goes to exactly this peer, and theirs appears here. The
// server refuses contact custody before mutuality (see functions/api/meet/
// contact.ts); this UI mirrors that rule rather than re-deciding it.

import { useState } from "react";
import { MEET } from "@/lib/meet/copy.ts";
import type { InboxData } from "@/lib/meet-net";

function ContactExchange({
  peerRef,
  peerName,
  myNote,
  theirNote,
  onSave,
}: {
  peerRef: string;
  peerName: string;
  myNote: string;
  theirNote: string | null;
  onSave: (peerRef: string, note: string) => Promise<boolean>;
}) {
  const [note, setNote] = useState(myNote);
  const [state, setState] = useState<"idle" | "saved" | "failed">("idle");

  return (
    <div style={{ marginTop: "0.6rem" }}>
      <p className="m-note" style={{ margin: "0 0 0.4rem", color: "var(--shu-deep)" }}>
        {MEET.home.signals.mutual} {MEET.home.signals.contactNote}
      </p>
      {theirNote !== null ? (
        <div className="m-proposal" style={{ marginBottom: "0.5rem" }}>
          <p className="m-item-tags" style={{ margin: 0 }}>
            {MEET.home.signals.theirNote(peerName)}
          </p>
          <p className="m-item-text" style={{ whiteSpace: "pre-wrap" }}>
            {theirNote}
          </p>
        </div>
      ) : (
        <p className="m-note" style={{ margin: "0 0 0.5rem" }}>
          {MEET.home.signals.waitingNote}
        </p>
      )}
      <div style={{ display: "flex", gap: "0.4rem" }}>
        <input
          className="m-field"
          value={note}
          onChange={(e) => {
            setNote(e.target.value);
            setState("idle");
          }}
          placeholder={MEET.home.signals.contactPlaceholder}
        />
        <button
          type="button"
          className="m-btn m-btn-quiet"
          disabled={note.trim() === ""}
          onClick={() => {
            void onSave(peerRef, note.trim()).then((ok) => setState(ok ? "saved" : "failed"));
          }}
        >
          {state === "saved" ? MEET.home.signals.contactSaved : MEET.home.signals.contactSave}
        </button>
      </div>
      {state === "failed" && (
        <p className="m-note" aria-live="polite" style={{ color: "var(--shu-deep)" }}>
          {MEET.receive.errors.network}
        </p>
      )}
    </div>
  );
}

export function SignalsSection({
  inbox,
  onTalkBack,
  onSaveContact,
}: {
  inbox: InboxData | null;
  onTalkBack: (toRef: string) => Promise<void>;
  onSaveContact: (peerRef: string, note: string) => Promise<boolean>;
}) {
  const incoming = inbox?.incoming ?? [];
  return (
    <section className="m-section">
      <h2 className="m-h2">{MEET.home.signals.heading}</h2>
      <p className="m-note" style={{ margin: "0 0 0.5rem" }}>
        {MEET.home.signals.subnote}
      </p>
      {incoming.length === 0 ? (
        <div className="m-empty">{MEET.home.signals.empty}</div>
      ) : (
        <ul className="m-itemlist">
          {incoming.map((sig) => {
            const theirNote =
              inbox?.notes.find((n) => n.fromRef === sig.fromRef)?.note ?? null;
            const myNote = inbox?.myNotes.find((n) => n.peerRef === sig.fromRef)?.note ?? "";
            return (
              <li key={sig.fromRef} className="m-item">
                <p className="m-item-title" style={{ margin: 0 }}>
                  {MEET.home.signals.incoming(sig.fromName)}
                </p>
                {sig.fromIntro.trim() !== "" && (
                  <p className="m-item-tags" style={{ margin: "0.1rem 0 0" }}>
                    {sig.fromName}——{sig.fromIntro}
                  </p>
                )}
                {sig.anchor !== "" && <p className="m-item-text">{sig.anchor}</p>}
                {sig.mutual ? (
                  <ContactExchange
                    peerRef={sig.fromRef}
                    peerName={sig.fromName}
                    myNote={myNote}
                    theirNote={theirNote}
                    onSave={onSaveContact}
                  />
                ) : (
                  <>
                    <button
                      type="button"
                      className="m-btn m-btn-primary"
                      style={{ marginTop: "0.5rem" }}
                      onClick={() => void onTalkBack(sig.fromRef)}
                    >
                      {MEET.home.signals.talkBack}
                    </button>
                    <p className="m-note">{MEET.proposal.mutualNote}</p>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
