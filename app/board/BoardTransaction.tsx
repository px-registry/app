"use client";

// A2 transaction surface on the board detail page. Three things:
//   1. Contact — resolves the owner's own external contact and opens it. PX does
//      not relay or store messages.
//   2. Timeline — the record chain (events + declarations) for this listing.
//   3. Owner actions — if signed in, the owner can record event material about
//      their own listing (handoff draft, declaration). The server authorizes;
//      a non-owner gets a clear refusal.
//
// All of this is event material. No message body / PII is ever sent to PX.

import { useCallback, useEffect, useState } from "react";
import {
  TRANSACTION_EVENT_LABELS,
  DECLARATION_KIND_LABELS,
  TRANSACTION_COPY,
} from "@/lib/board/copy.ts";

interface TxEvent {
  eventId: string;
  kind: string;
  ref: string | null;
  at: string;
}
interface TxDeclaration {
  declarationId: string;
  kind: string;
  ownerPublicRef: string;
  createdAt: string;
}
interface TxObject {
  events: TxEvent[];
  declarations: TxDeclaration[];
  declarationRefs: string[];
}

export function BoardTransaction({ recordId }: { recordId: string }) {
  const [tx, setTx] = useState<TxObject | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadTx = useCallback(async () => {
    try {
      const res = await fetch(`/api/board/transaction?recordId=${encodeURIComponent(recordId)}`);
      const body = (await res.json()) as TxObject;
      setTx({
        events: body.events ?? [],
        declarations: body.declarations ?? [],
        declarationRefs: body.declarationRefs ?? [],
      });
    } catch {
      setTx({ events: [], declarations: [], declarationRefs: [] });
    }
  }, [recordId]);

  useEffect(() => {
    void loadTx();
    (async () => {
      try {
        const me = (await (await fetch("/api/auth/me")).json()) as { signed_in?: boolean };
        setSignedIn(!!me.signed_in);
      } catch {
        setSignedIn(false);
      }
    })();
  }, [loadTx]);

  const openContact = useCallback(async () => {
    try {
      const res = await fetch(`/api/board/contact?recordId=${encodeURIComponent(recordId)}`);
      const body = (await res.json()) as { contactActionUrl: string | null };
      if (body.contactActionUrl) window.open(body.contactActionUrl, "_blank", "noopener,noreferrer");
      else setNote("This listing has no contact link.");
    } catch {
      setNote("Could not resolve the contact link.");
    }
  }, [recordId]);

  const postEvent = useCallback(
    async (payload: Record<string, unknown>) => {
      setBusy(true);
      setNote(null);
      try {
        const res = await fetch("/api/board/event", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ recordId, ...payload }),
        });
        if (res.status === 401) setNote("Sign in to record this.");
        else if (res.status === 403) setNote("Only the listing's owner can record this.");
        else if (!res.ok) setNote("Could not record the event.");
        else await loadTx();
      } catch {
        setNote("Could not record the event.");
      } finally {
        setBusy(false);
      }
    },
    [recordId, loadTx],
  );

  const recordHandoffDraft = useCallback(() => {
    const url = window.prompt("Owner-controlled handoff URL (https://…):");
    if (url) void postEvent({ kind: "handoff_draft_created", actionUrl: url });
  }, [postEvent]);

  return (
    <section className="board-tx" aria-label="Transaction record">
      <div className="board-tx-contact">
        <button type="button" className="board-action-link" onClick={openContact}>
          {TRANSACTION_COPY.contactAction.en} →
        </button>
        <span className="board-action-note">{TRANSACTION_COPY.contactNote.en}</span>
      </div>

      <h2 className="board-tx-h">Record chain</h2>
      {tx === null ? (
        <p className="entries">Loading…</p>
      ) : tx.events.length === 0 && tx.declarations.length === 0 ? (
        <p className="board-action-note">No events recorded yet.</p>
      ) : (
        <ul className="board-tx-timeline">
          {tx.events.map((e) => (
            <li key={e.eventId}>
              <span className="board-tx-kind">
                {TRANSACTION_EVENT_LABELS[e.kind]?.en ?? e.kind}
              </span>
              {e.ref && e.kind === "handoff_draft_created" && (
                <a className="board-link" href={e.ref} target="_blank" rel="noopener noreferrer">
                  owner link →
                </a>
              )}
              <span className="board-tx-at">{e.at}</span>
            </li>
          ))}
        </ul>
      )}

      {tx && tx.declarations.length > 0 && (
        <>
          <h2 className="board-tx-h">Owner declarations</h2>
          <p className="board-action-note">{TRANSACTION_COPY.declarationNote.en}</p>
          <ul className="board-tx-timeline">
            {tx.declarations.map((d) => (
              <li key={d.declarationId}>
                <span className="board-tx-kind">
                  {DECLARATION_KIND_LABELS[d.kind]?.en ?? d.kind}
                </span>
                <code className="board-record-id">{d.declarationId}</code>
              </li>
            ))}
          </ul>
        </>
      )}

      {signedIn && (
        <div className="board-tx-owner">
          <h2 className="board-tx-h">Owner actions</h2>
          <div className="board-tx-buttons">
            <button type="button" className="board-chip" disabled={busy} onClick={() => postEvent({ kind: "contact_opened" })}>
              Record contact
            </button>
            <button type="button" className="board-chip" disabled={busy} onClick={recordHandoffDraft}>
              Handoff draft
            </button>
            <button type="button" className="board-chip" disabled={busy} onClick={() => postEvent({ kind: "owner_declaration_created", declarationKind: "handoff" })}>
              Declare handoff
            </button>
            <button type="button" className="board-chip" disabled={busy} onClick={() => postEvent({ kind: "owner_declaration_created", declarationKind: "exchange" })}>
              Declare exchange
            </button>
          </div>
        </div>
      )}

      {note && <p className="board-error">{note}</p>}
    </section>
  );
}
