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
  toPublicView,
} from "@/lib/meet-memory";
import { getPublishedSnapshot, snapshotHas } from "@/lib/meet-net";
import type { RigMemoryItemV1 } from "@/lib/rig";

type Phase = "paste" | "review" | "done";

export function ColdStartIntake() {
  const [phase, setPhase] = useState<Phase>("paste");
  const [copied, setCopied] = useState<"idle" | "done" | "failed">("idle");
  const [paste, setPaste] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [items, setItems] = useState<RigMemoryItemV1[]>([]);
  const [busy, setBusy] = useState(false);
  // c15-4: 追加 or 置き換え — the non-destructive side is the default
  const [mode, setMode] = useState<"add" | "replace">("add");
  const [poolNotice, setPoolNotice] = useState(false);

  const copyPrompt = async () => {
    // Clipboard can be unavailable (permissions, in-app browsers) — the full
    // text below is the always-works fallback, so the loop never blocks here.
    try {
      await navigator.clipboard.writeText(COLDSTART_PROMPT);
      setCopied("done");
    } catch {
      setCopied("failed");
    }
    setTimeout(() => setCopied("idle"), 2500);
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
      // c15-4 置き換え: the OLD cards go first (忘却は owner の行為 — this
      // explicit choice is it). 出す状態だった項目はプールに押し直しまで残る
      // ので、c15-3 の注意行を done 面に出す（沈黙の禁止）。
      if (mode === "replace") {
        const snap = getPublishedSnapshot();
        const old = await store.listRigItems();
        if (old.some((e) => e.item.private === false && snapshotHas(snap, toPublicView(e.item)))) {
          setPoolNotice(true);
        }
        for (const e of old) await store.remove(e.entryId);
      }
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
        {poolNotice && (
          <p className="m-note" aria-live="polite" style={{ color: "var(--shu-deep)" }}>
            {MEET.memory.poolNotice}
          </p>
        )}
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
        {/* c15-4: 追加（既定・非破壊）か、すべて置き換えるか */}
        <div className="m-kindrow" style={{ marginTop: "1rem" }}>
          <button
            type="button"
            className={`m-chip m-chip-pick ${mode === "add" ? "m-chip-active" : ""}`}
            aria-pressed={mode === "add"}
            onClick={() => setMode("add")}
          >
            {MEET.intake.addMode}
          </button>
          <button
            type="button"
            className={`m-chip m-chip-pick ${mode === "replace" ? "m-chip-active" : ""}`}
            aria-pressed={mode === "replace"}
            onClick={() => setMode("replace")}
          >
            {MEET.intake.replaceMode}
          </button>
        </div>
        <div style={{ display: "grid", gap: "0.5rem", marginTop: "0.5rem" }}>
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
      <button type="button" className="m-btn m-btn-quiet m-btn-wide" onClick={() => void copyPrompt()}>
        {copied === "done" ? MEET.intake.copied : MEET.intake.copyPrompt}
      </button>
      {copied === "failed" && (
        <p className="m-note" aria-live="polite" style={{ color: "var(--shu-deep)" }}>
          {MEET.intake.copyFailed}
        </p>
      )}
      <details style={{ margin: "0.5rem 0" }}>
        <summary className="m-note" style={{ cursor: "pointer" }}>
          {MEET.intake.showPrompt}
        </summary>
        <textarea className="m-field" rows={8} readOnly value={COLDSTART_PROMPT} />
      </details>
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
