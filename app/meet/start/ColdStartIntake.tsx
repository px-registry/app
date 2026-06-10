"use client";

// R1.5 step 2 — cold-start intake: copy the prompt → paste the AI's reply →
// review every item (公開/非公開 included) → confirm. Nothing is stored until
// the owner confirms; confirmed items land owner-local only
// (provenance: owner_imported_confirmed).

import { useState } from "react";
import { MEET } from "@/lib/meet/copy.ts";
import {
  COLDSTART_PROMPT,
  COLDSTART_NOTE,
  parseColdStartPaste,
  openMeetMemory,
} from "@/lib/meet-memory";
import type { RigMemoryItemV1 } from "@/lib/rig";

type Phase = "paste" | "review" | "done";

export function ColdStartIntake() {
  const [phase, setPhase] = useState<Phase>("paste");
  const [copied, setCopied] = useState(false);
  const [paste, setPaste] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [items, setItems] = useState<RigMemoryItemV1[]>([]);
  const [busy, setBusy] = useState(false);

  const copyPrompt = async () => {
    await navigator.clipboard.writeText(COLDSTART_PROMPT);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const parse = () => {
    const r = parseColdStartPaste(paste);
    setWarnings(r.warnings);
    if (r.items.length > 0) {
      setItems(r.items);
      setPhase("review");
    }
  };

  const togglePublic = (i: number) => {
    setItems((prev) => prev.map((it, j) => (j === i ? { ...it, private: !it.private } : it)));
  };

  const confirm = async () => {
    setBusy(true);
    try {
      const store = openMeetMemory();
      for (const item of items) {
        await store.create({
          kind: "rig_item",
          provenance: "owner_imported_confirmed",
          value: item,
        });
      }
      setPhase("done");
    } finally {
      setBusy(false);
    }
  };

  if (phase === "done") {
    return (
      <div>
        <p style={{ margin: 0, color: "var(--text)" }}>{MEET.intake.done}</p>
        <p className="m-note">
          <a href="/meet/memory/" style={{ color: "var(--shu-deep)" }}>
            {MEET.nav.memory}
          </a>
          でいつでも直せます。
        </p>
      </div>
    );
  }

  if (phase === "review") {
    return (
      <div>
        <h3 className="m-h2" style={{ fontSize: "1rem" }}>
          {MEET.intake.reviewHeading}
        </h3>
        <p className="m-note" style={{ marginBottom: "0.75rem" }}>
          {MEET.intake.reviewNote}
        </p>
        <ul className="m-itemlist">
          {items.map((it, i) => (
            <li key={i} className="m-item">
              <div className="m-item-head">
                <span className="m-chip">{MEET.kinds[it.kind]}</span>
                <button
                  type="button"
                  className={`m-toggle ${it.private ? "" : "m-toggle-on"}`}
                  onClick={() => togglePublic(i)}
                  aria-pressed={!it.private}
                >
                  {it.private ? MEET.intake.privateLabel : MEET.intake.publicLabel}
                </button>
              </div>
              {it.title && <p className="m-item-title">{it.title}</p>}
              <p className="m-item-text">{it.text}</p>
              {it.tags.length > 0 && <p className="m-item-tags">{it.tags.join(" / ")}</p>}
            </li>
          ))}
        </ul>
        <div style={{ display: "grid", gap: "0.5rem", marginTop: "1rem" }}>
          <button type="button" className="m-btn m-btn-primary m-btn-wide" onClick={confirm} disabled={busy}>
            {MEET.intake.confirm(items.length)}
          </button>
          <button type="button" className="m-btn m-btn-quiet m-btn-wide" onClick={() => setPhase("paste")}>
            {MEET.intake.redo}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <button type="button" className="m-btn m-btn-quiet m-btn-wide" onClick={copyPrompt}>
        {copied ? MEET.intake.copied : MEET.intake.copyPrompt}
      </button>
      <p className="m-note" style={{ margin: "0.6rem 0" }}>
        {COLDSTART_NOTE}
      </p>
      <label className="m-note" style={{ display: "block", marginBottom: "0.3rem" }}>
        {MEET.intake.pasteLabel}
      </label>
      <textarea
        className="m-field"
        rows={6}
        value={paste}
        onChange={(e) => setPaste(e.target.value)}
        placeholder={MEET.intake.pastePlaceholder}
      />
      {warnings.length > 0 && (
        <ul className="m-warnings">
          {warnings.map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ul>
      )}
      <button
        type="button"
        className="m-btn m-btn-primary m-btn-wide"
        style={{ marginTop: "0.6rem" }}
        onClick={parse}
        disabled={paste.trim() === ""}
      >
        {MEET.intake.parse}
      </button>
    </div>
  );
}
