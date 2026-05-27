"use client";

// PX card — a hand-off tool. The hand-off is the hero, expressed as the handle
// text (large, accent); the name is smaller; the contact smallest and freeform.
// The QR is a real, scannable code but demoted to a small, quiet accent in the
// corner — intellectual + restrained, not a wall of modules.
//
// Stubs that remain: the contact is device-local (localStorage) until an
// owner-record / encrypted-at-rest design lands. Unsigned visitors see a sample
// preview so the card is viewable without a session.

import { useEffect, useMemo, useState, type ReactNode } from "react";
import qrcode from "qrcode-generator";
import { fetchMe, type MeResponse } from "@/lib/auth-client.ts";

const SAMPLE = {
  handle: "ito-atelier",
  name: "伊藤 篤",
  contact: "ito@atelier.jp\n@itoatelier",
};

// A real QR (smallest fitting matrix, EC level M) rendered as a quiet SVG. Drawn
// inverted (light modules on the dark card) to stay on-theme; the handle text is
// the primary hand-off, so the code is an accent — modern phone cameras read
// inverted codes. A 1-module quiet zone is baked into the viewBox.
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
  const margin = 1;
  return (
    <svg
      className="pxcard-qr"
      viewBox={`${-margin} ${-margin} ${n + margin * 2} ${n + margin * 2}`}
      role="img"
      aria-label="Scan or open this card"
    >
      {rects}
    </svg>
  );
}

export function BusinessCard() {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [contact, setContact] = useState("");
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    let live = true;
    fetchMe().then((m) => {
      if (!live) return;
      setMe(m.signed_in ? m : null);
      setLoaded(true);
      if (m.signed_in && m.handle) {
        setContact(localStorage.getItem(`pxcard:contact:${m.handle}`) || "");
      }
    });
    return () => {
      live = false;
    };
  }, []);

  function saveContact(v: string) {
    setContact(v);
    if (me?.handle) localStorage.setItem(`pxcard:contact:${me.handle}`, v);
  }

  if (!loaded) {
    return <p className="shell-checking">Loading…</p>;
  }

  const preview = !me;
  const handle = me?.handle ?? SAMPLE.handle;
  const url = `${handle}.px-registry.org`;
  const fullUrl = `https://${url}`;
  const name = me?.display_name?.trim() || (preview ? SAMPLE.name : `@${handle}`);
  const shownContact = preview ? SAMPLE.contact : contact;
  const contactLines = shownContact.split("\n").filter((l) => l.trim());

  return (
    <section className="pxcard-wrap">
      <article className="pxcard">
        {/* Hand-off — hero. The handle text is the primary, typeable hand-off. */}
        <div className="pxcard-id">
          <a className="pxcard-handle" href={fullUrl}>
            {handle}
          </a>
          <span className="pxcard-domain">.px-registry.org</span>
        </div>

        <h1 className="pxcard-name">{name}</h1>

        <div className="pxcard-contact">
          {!preview && editing ? (
            <textarea
              className="pxcard-contact-input"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              onBlur={() => {
                saveContact(contact);
                setEditing(false);
              }}
              placeholder="ito@atelier.jp&#10;@itoatelier"
              rows={2}
              autoFocus
            />
          ) : contactLines.length ? (
            <button
              type="button"
              className="pxcard-contact-display"
              onClick={() => !preview && setEditing(true)}
              title={preview ? undefined : "Edit contact"}
            >
              {contactLines.map((l, i) => (
                <span key={i}>{l}</span>
              ))}
            </button>
          ) : (
            <button
              type="button"
              className="pxcard-contact-empty"
              onClick={() => setEditing(true)}
            >
              + contact (anything — email, @social, …)
            </button>
          )}
        </div>

        {/* QR — small, quiet accent in the corner. */}
        <a className="pxcard-qr-link" href={fullUrl} aria-label="Open this card">
          <QrAccent url={fullUrl} />
        </a>
      </article>

      {preview ? (
        <p className="pxcard-note">
          Preview — a sample card. <a href="/signup/">Create your identity →</a>{" "}
          to make your own.
        </p>
      ) : (
        <p className="pxcard-note">
          Your contact is saved on this device only for now.
        </p>
      )}
    </section>
  );
}
