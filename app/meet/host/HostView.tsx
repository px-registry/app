"use client";

// 進行役 — the facilitator's view of the test-disclosed lane: five people's
// received proposals + readings, and the signal flow. Key-gated server-side
// (fail-closed); the key lives only in this component's state, typed per visit.
// Contact notes are structurally absent — the host endpoint never reads them.

import { useState } from "react";
import { MEET } from "@/lib/meet/copy.ts";
import { fetchHostView } from "@/lib/meet-net";

type LogRow = {
  participantRef: string;
  entryId: string;
  displayName: string;
  question: string;
  proposalText: string;
  reading: string;
  createdAt: string;
  updatedAt: string;
};
type SigRow = { fromName: string; fromRef: string; toRef: string; createdAt: string };
type PoolRow = { ownerRef: string; kind: string; title: string; text: string; tags: string[] };

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function parseReading(s: string): { echo: boolean; cards: Record<string, { marks?: string[]; note?: string }> } | null {
  try {
    const v = JSON.parse(s);
    return isRecord(v) ? { echo: v.echo === true, cards: isRecord(v.cards) ? (v.cards as never) : {} } : null;
  } catch {
    return null;
  }
}

export function HostView() {
  const [hostKey, setHostKey] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "failed" | "ready">("idle");
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [signals, setSignals] = useState<SigRow[]>([]);
  const [pool, setPool] = useState<PoolRow[]>([]);

  const open = async () => {
    setState("busy");
    const r = await fetchHostView(hostKey.trim());
    if (!r.ok) {
      setState("failed");
      return;
    }
    setLogs(
      r.logs.filter(isRecord).map((l) => ({
        participantRef: str(l.participantRef),
        entryId: str(l.entryId),
        displayName: str(l.displayName),
        question: str(l.question),
        proposalText: str(l.proposalText),
        reading: str(l.reading),
        createdAt: str(l.createdAt),
        updatedAt: str(l.updatedAt),
      })),
    );
    setSignals(
      r.signals.filter(isRecord).map((s) => ({
        fromName: str(s.fromName),
        fromRef: str(s.fromRef),
        toRef: str(s.toRef),
        createdAt: str(s.createdAt),
      })),
    );
    setPool(
      r.pool.filter(isRecord).map((p) => ({
        ownerRef: str(p.ownerRef),
        kind: str(p.kind),
        title: str(p.title),
        text: str(p.text),
        tags: Array.isArray(p.tags) ? p.tags.filter((t): t is string => typeof t === "string") : [],
      })),
    );
    setState("ready");
  };

  if (state !== "ready") {
    return (
      <section className="m-section">
        <h1 className="m-h1">{MEET.host.title}</h1>
        <div className="m-card">
          <label className="m-note">{MEET.host.keyLabel}</label>
          <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.3rem" }}>
            <input
              className="m-field"
              type="password"
              value={hostKey}
              onChange={(e) => setHostKey(e.target.value)}
              autoComplete="off"
            />
            <button
              type="button"
              className="m-btn m-btn-primary"
              disabled={hostKey.trim() === "" || state === "busy"}
              onClick={() => void open()}
            >
              {MEET.host.open}
            </button>
          </div>
          {state === "failed" && (
            <p className="m-note" aria-live="polite" style={{ color: "var(--shu-deep)" }}>
              {MEET.host.failed}
            </p>
          )}
        </div>
      </section>
    );
  }

  // Group rows per participant, preserving the server's name/time order.
  const groups: Array<{ name: string; rows: LogRow[] }> = [];
  for (const row of logs) {
    const last = groups[groups.length - 1];
    if (last && last.name === row.displayName) last.rows.push(row);
    else groups.push({ name: row.displayName, rows: [row] });
  }

  return (
    <>
      <section className="m-section">
        <h1 className="m-h1">{MEET.host.title}</h1>

        <h2 className="m-h2">{MEET.host.poolHeading}</h2>
        {pool.length === 0 ? (
          <div className="m-empty">{MEET.host.empty}</div>
        ) : (
          <ul className="m-itemlist">
            {pool.map((p, i) => (
              <li key={i} className="m-item">
                <div className="m-item-head">
                  <span className="m-chip">{MEET.kinds[p.kind] ?? p.kind}</span>
                  <span className="m-item-tags">{p.ownerRef}</span>
                </div>
                {p.title && <p className="m-item-title">{p.title}</p>}
                <p className="m-item-text">{p.text}</p>
                {p.tags.length > 0 && <p className="m-item-tags">{p.tags.join(" / ")}</p>}
              </li>
            ))}
          </ul>
        )}

        <h2 className="m-h2" style={{ marginTop: "1.5rem" }}>{MEET.host.signalsHeading}</h2>
        {signals.length === 0 ? (
          <div className="m-empty">{MEET.host.empty}</div>
        ) : (
          <ul className="m-itemlist">
            {signals.map((s, i) => (
              <li key={i} className="m-item">
                <p className="m-item-text" style={{ margin: 0 }}>
                  {s.fromName}（{s.fromRef.slice(0, 6)}） → {s.toRef.slice(0, 6)}
                </p>
                <p className="m-item-tags" style={{ margin: 0 }}>
                  {s.createdAt}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="m-section">
        <h2 className="m-h2">{MEET.host.logsHeading}</h2>
        {groups.length === 0 ? (
          <div className="m-empty">{MEET.host.empty}</div>
        ) : (
          groups.map((g) => (
            <div key={g.name} style={{ marginBottom: "1.5rem" }}>
              <h3 className="m-h2" style={{ fontSize: "1rem" }}>
                {g.name}
              </h3>
              <ul className="m-itemlist">
                {g.rows.map((row) => {
                  const reading = parseReading(row.reading);
                  const marks = reading
                    ? Object.values(reading.cards).flatMap((c) => c.marks ?? [])
                    : [];
                  const notes = reading
                    ? Object.values(reading.cards)
                        .map((c) => c.note ?? "")
                        .filter((n) => n !== "")
                    : [];
                  return (
                    <li key={row.entryId} className="m-item">
                      <p className="m-item-tags" style={{ margin: "0 0 0.3rem" }}>
                        {row.createdAt}
                        {row.question !== "" && <>（{row.question}）</>}
                      </p>
                      <p className="m-item-text" style={{ whiteSpace: "pre-wrap" }}>
                        {row.proposalText}
                      </p>
                      <p className="m-item-tags" style={{ marginTop: "0.4rem" }}>
                        {MEET.host.readingLabel}：
                        {marks.length === 0 && notes.length === 0
                          ? MEET.host.noReading
                          : [marks.join("・"), notes.join(" / ")].filter((s) => s !== "").join(" — ")}
                      </p>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        )}
      </section>
    </>
  );
}
