"use client";

// OwnerPopover — the owner's whole identity surface as a single summoned
// popover, not a destination page. PX positioning: identity is substrate, not
// center — you call it up from the corner badge or the composer rail, it isn't a
// place you navigate to. Folds the former /me/ + /me/card/ + /me/settings/ into
// one component: the PX card (handle hero + micro QR + freeform contact),
// settings (display name, default category), and sign-out.
//
// Triggered two ways, same instance: the AuthBadge button (popoverTarget) and a
// global "px:open-owner" event (dispatched by the composer rail). The contact is
// device-local (localStorage) until an owner-record / encrypted-at-rest design
// lands; PX holds no contact data.

import { useEffect, useMemo, useState, type ReactNode } from "react";
import qrcode from "qrcode-generator";
import { signOut, type MeResponse } from "@/lib/auth-client.ts";
import { OwnerSettingsForm } from "./OwnerSettingsForm.tsx";

export const OWNER_POPOVER_ID = "px-owner-popover";

// Real QR (smallest fitting matrix), drawn small/inverted as a quiet accent.
function QrAccent({ url }: { url: string }) {
  const { n, rects } = useMemo(() => {
    const qr = qrcode(0, "M");
    qr.addData(url);
    qr.make();
    const count = qr.getModuleCount();
    const out: ReactNode[] = [];
    for (let r = 0; r < count; r++) {
      for (let c = 0; c < count; c++) {
        if (qr.isDark(r, c)) {
          out.push(<rect key={r * count + c} x={c} y={r} width={1} height={1} />);
        }
      }
    }
    return { n: count, rects: out };
  }, [url]);
  const m = 1;
  return (
    <svg
      className="pxcard-qr"
      viewBox={`${-m} ${-m} ${n + m * 2} ${n + m * 2}`}
      role="img"
      aria-label="Scan or open this card"
    >
      {rects}
    </svg>
  );
}

export function OwnerPopover({ me }: { me: MeResponse }) {
  const handle = me.handle ?? "";
  const url = `${handle}.px-registry.org`;
  const fullUrl = `https://${url}`;

  // The card's name mirrors the settings form's display name live (the form
  // owns the persisted state; this is just the card label).
  const [cardName, setCardName] = useState(me.display_name ?? "");
  const [contact, setContact] = useState("");
  const [editingContact, setEditingContact] = useState(false);

  useEffect(() => {
    if (handle) setContact(localStorage.getItem(`pxcard:contact:${handle}`) || "");
  }, [handle]);

  const name = cardName.trim() || `@${handle}`;
  const contactLines = contact.split("\n").filter((l) => l.trim());

  function saveContact(v: string) {
    setContact(v);
    if (handle) localStorage.setItem(`pxcard:contact:${handle}`, v);
  }

  async function doSignOut() {
    await signOut();
    window.location.href = "/";
  }

  return (
    <div id={OWNER_POPOVER_ID} popover="auto" className="owner-pop">
      {/* Card — the hand-off. Handle text is the hero; QR a quiet corner accent. */}
      <div className="owner-card">
        <div className="pxcard-id">
          <a className="pxcard-handle" href={fullUrl}>
            {handle}
          </a>
          <span className="pxcard-domain">.px-registry.org</span>
        </div>
        <p className="pxcard-name">{name}</p>
        <div className="pxcard-contact">
          {editingContact ? (
            <textarea
              className="pxcard-contact-input"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              onBlur={() => {
                saveContact(contact);
                setEditingContact(false);
              }}
              placeholder="ito@atelier.jp&#10;@itoatelier"
              rows={2}
              autoFocus
            />
          ) : contactLines.length ? (
            <button
              type="button"
              className="pxcard-contact-display"
              onClick={() => setEditingContact(true)}
              title="Edit contact"
            >
              {contactLines.map((l, i) => (
                <span key={i}>{l}</span>
              ))}
            </button>
          ) : (
            <button
              type="button"
              className="pxcard-contact-empty"
              onClick={() => setEditingContact(true)}
            >
              + contact (anything — email, @social, …)
            </button>
          )}
        </div>
        <a className="owner-qr-link" href={fullUrl} aria-label="Open this card">
          <QrAccent url={fullUrl} />
        </a>
      </div>

      {/* Settings — shared with the composer's 設定 tool (SettingsPanel). */}
      <OwnerSettingsForm
        initialDisplayName={me.display_name ?? ""}
        initialCategory={me.default_category ?? ""}
        onDisplayNameChange={setCardName}
      />

      <div className="owner-actions">
        <button type="button" className="auth-signout" onClick={doSignOut}>
          Sign out
        </button>
      </div>
    </div>
  );
}
