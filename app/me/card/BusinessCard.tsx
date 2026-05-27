"use client";

// PX card — a hand-off tool, not an info sheet. The product is the verifiable
// hand-off itself, so the exchange is the hero: hand-off (the address + code) on
// top and largest, the name smaller, the contact smallest and freeform. Three
// elements, nothing else.
//
// First pass / honest stubs: the code is a deterministic DECORATIVE placeholder
// (not a scannable QR — real QR generation is a follow-up); the contact is a
// freeform line kept in localStorage for now (no field on the owner record yet).

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { fetchMe, type MeResponse } from "@/lib/auth-client.ts";

const QR_SIZE = 21; // QR v1 grid; here purely decorative.

// Deterministic on/off grid from a seed string (xorshift32 over FNV-1a), with
// the three QR finder patterns drawn in so it reads as a hand-off code.
function buildGrid(seed: string, size: number): boolean[] {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  let s = h || 1;
  const rand = () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
  const grid = new Array<boolean>(size * size);
  for (let i = 0; i < grid.length; i++) grid[i] = rand() < 0.45;
  const finder = (r: number, c: number) => {
    for (let i = 0; i < 7; i++)
      for (let j = 0; j < 7; j++) {
        const ring = i === 0 || i === 6 || j === 0 || j === 6;
        const core = i >= 2 && i <= 4 && j >= 2 && j <= 4;
        grid[(r + i) * size + (c + j)] = ring || core;
      }
    // quiet margin row/col just inside the finder
    for (let k = 0; k < 8; k++) {
      if (r + 7 < size) grid[(r + 7) * size + (c + (k < 7 ? k : 0))] = false;
      if (c + 7 < size) grid[(r + (k < 7 ? k : 0)) * size + (c + 7)] = false;
    }
  };
  finder(0, 0);
  finder(0, size - 7);
  finder(size - 7, 0);
  return grid;
}

function HandoffCode({ seed }: { seed: string }) {
  const grid = useMemo(() => buildGrid(seed, QR_SIZE), [seed]);
  const rects: ReactNode[] = [];
  for (let r = 0; r < QR_SIZE; r++) {
    for (let c = 0; c < QR_SIZE; c++) {
      if (grid[r * QR_SIZE + c]) {
        rects.push(<rect key={r * QR_SIZE + c} x={c} y={r} width={1} height={1} />);
      }
    }
  }
  return (
    <svg
      className="pxcard-code"
      viewBox={`-1 -1 ${QR_SIZE + 2} ${QR_SIZE + 2}`}
      role="img"
      aria-label="Hand-off code (placeholder)"
    >
      {rects}
    </svg>
  );
}

// Sample shown to logged-out visitors so the card is viewable as a preview
// (and so the design can be seen without a session).
const SAMPLE = {
  handle: "ito-atelier",
  name: "伊藤 篤",
  contact: "ito@atelier.jp\n@itoatelier",
};

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
  const name = me?.display_name?.trim() || (preview ? SAMPLE.name : `@${handle}`);
  const shownContact = preview ? SAMPLE.contact : contact;
  const contactLines = shownContact.split("\n").filter((l) => l.trim());

  return (
    <section className="pxcard-wrap">
      <article className="pxcard">
        {/* Hand-off — hero. The address is the real, working hand-off; the code
            is a decorative placeholder until real QR generation lands. */}
        <div className="pxcard-handoff">
          <HandoffCode seed={handle} />
          <a className="pxcard-url" href={`https://${url}`}>
            {url}
          </a>
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
      </article>

      {preview ? (
        <p className="pxcard-note">
          Preview — a sample card. <a href="/signup/">Create your identity →</a>{" "}
          to make your own.
        </p>
      ) : (
        <p className="pxcard-note">
          First pass — the code is a placeholder (real QR next); the contact is
          saved on this device only for now.
        </p>
      )}
    </section>
  );
}
