"use client";

// The Attested Board surface (/search/). Lists public board records from
// /api/search, with user-selected filters only — surface_shape, intent, and
// free text. No recommendation, no ranking knob, no paid placement: the order is
// whatever the board returns (newest-first), and the filters narrow, never widen.
//
// Static-export safe: a client component that fetches at runtime and reads its
// initial filters from window.location (no useSearchParams/Suspense dance).

import { useEffect, useState, useCallback, useMemo } from "react";
import { SURFACE_SHAPES, INTENTS } from "@/lib/board/canonical.ts";
import { surfaceShapeLabel, intentLabel } from "@/lib/board/copy.ts";
import { boardDetailPath } from "@/lib/board/href.ts";
import type { SurfaceShape, Intent } from "@/lib/board/canonical.ts";
import type { BoardRecordV1 } from "@/lib/board/types.ts";
import { OwnerMemoryStore, type SavedFilterValue } from "@/lib/owner-memory/index.ts";
import { IndexedDbBackend } from "@/lib/owner-memory/indexeddb.ts";
import { BLOCK6_COPY } from "@/lib/public-copy/index.ts";

type ShapeFilter = SurfaceShape | "all";
type IntentFilter = Intent | "all";

export function BoardSearch() {
  const [shape, setShape] = useState<ShapeFilter>("all");
  const [intent, setIntent] = useState<IntentFilter>("all");
  const [q, setQ] = useState("");
  const [records, setRecords] = useState<BoardRecordV1[] | null>(null);
  const [error, setError] = useState(false);
  const [saved, setSaved] = useState(false);

  // Owner-local store. Saving a filter is an explicit owner action that writes
  // ONLY to this device; the board itself stays neutral and server-blind.
  const memory = useMemo(() => new OwnerMemoryStore(new IndexedDbBackend()), []);

  const saveFilter = useCallback(async () => {
    const value: SavedFilterValue = {};
    if (shape !== "all") value.surfaceShape = shape;
    if (intent !== "all") value.intent = intent;
    if (q.trim()) value.query = q.trim();
    await memory.create({ kind: "saved_filter", provenance: "owner_written", value });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  }, [shape, intent, q, memory]);

  // Seed filters from the URL once, so a shared /search/?surface_shape=… link
  // opens pre-filtered.
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const s = sp.get("surface_shape");
    const i = sp.get("intent");
    if (s && (SURFACE_SHAPES as readonly string[]).includes(s)) setShape(s as SurfaceShape);
    if (i && (INTENTS as readonly string[]).includes(i)) setIntent(i as Intent);
    const text = sp.get("q");
    if (text) setQ(text);
  }, []);

  const load = useCallback(async () => {
    const sp = new URLSearchParams();
    if (shape !== "all") sp.set("surface_shape", shape);
    if (intent !== "all") sp.set("intent", intent);
    if (q.trim()) sp.set("q", q.trim());
    try {
      const res = await fetch(`/api/search?${sp.toString()}`);
      const body = (await res.json()) as { records?: BoardRecordV1[] };
      setRecords(body.records ?? []);
      setError(!res.ok);
    } catch {
      setRecords([]);
      setError(true);
    }
  }, [shape, intent, q]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <p className="demo-banner" role="note">
        Sample boards (demo) — not real sellers or contacts.{" "}
        <span lang="ja">サンプルの板です（デモ）。実在の出品者・連絡先ではありません。</span>
      </p>

      {/* Block #6 A — the board's framing (frozen public copy). */}
      <header className="board-framing">
        <p className="board-framing-h">
          {BLOCK6_COPY.boardHeading.en[0]}{" "}
          <span lang="ja">{BLOCK6_COPY.boardHeading.ja[0]}</span>
        </p>
        <p className="board-framing-body">{BLOCK6_COPY.boardBody.en.join(" ")}</p>
        <p className="board-framing-body" lang="ja">{BLOCK6_COPY.boardBody.ja.join("")}</p>
      </header>

      <div className="board-filters" role="group" aria-label="Board filters">
        <div className="board-filter-row">
          <span className="board-filter-label">Surface</span>
          <FilterChip active={shape === "all"} onClick={() => setShape("all")} label="All" />
          {SURFACE_SHAPES.map((s) => (
            <FilterChip
              key={s}
              active={shape === s}
              onClick={() => setShape(s)}
              label={surfaceShapeLabel(s).en}
              ja={surfaceShapeLabel(s).ja}
            />
          ))}
        </div>
        <div className="board-filter-row">
          <span className="board-filter-label">Intent</span>
          <FilterChip active={intent === "all"} onClick={() => setIntent("all")} label="All" />
          {INTENTS.map((i) => (
            <FilterChip
              key={i}
              active={intent === i}
              onClick={() => setIntent(i)}
              label={intentLabel(i).en}
              ja={intentLabel(i).ja}
            />
          ))}
        </div>
        <input
          className="board-search-input"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search the board…"
          aria-label="Search the board"
        />
        <div className="board-filter-row">
          <button type="button" className="board-chip" onClick={saveFilter}>
            {saved ? "Saved on this device ✓" : "Save this filter"}
          </button>
          <a className="board-link" href="/board/stand/">
            Stand a board →
          </a>
          <a className="board-link" href="/memory/">
            Your memory →
          </a>
        </div>
      </div>

      {records === null ? (
        <p className="entries">Loading…</p>
      ) : (
        <>
          <p className="entries">
            <span className="entries-num">{records.length}</span>{" "}
            {records.length === 1 ? "record" : "records"}
            {error && <span className="board-error"> · the board is unavailable</span>}
          </p>
          {records.length > 0 ? (
            <ul className="listings">
              {records.map((r) => (
                <li key={r.recordId}>
                  <a className="listing" href={boardDetailPath(r)}>
                    <span className="listing-main">
                      <span className="listing-title">{r.title}</span>
                      <span className="listing-sender">{r.ownerPublicRef}</span>
                    </span>
                    <span className="listing-aside">
                      <span className="listing-type">{surfaceShapeLabel(r.surfaceShape).en}</span>
                      <span className="board-intent" lang="ja">
                        {intentLabel(r.intent).ja}
                      </span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            !error && (
              /* Block #6 A — empty state (frozen). */
              <p className="board-action-note">
                {BLOCK6_COPY.boardEmpty.en[0]}{" "}
                <span lang="ja">{BLOCK6_COPY.boardEmpty.ja[0]}</span>
              </p>
            )
          )}
        </>
      )}

      {/* Block #6 B + F — what PX does (and does not) do, and the closed-beta report stance. */}
      <details className="mem-boundary board-boundary">
        <summary>What PX does (and does not) do</summary>
        <ul>
          {BLOCK6_COPY.boundary.en.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>
        <ul lang="ja">
          {BLOCK6_COPY.boundary.ja.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>
        <p className="board-action-note">{BLOCK6_COPY.report.en[0]}</p>
        <p className="board-action-note" lang="ja">{BLOCK6_COPY.report.ja[0]}</p>
      </details>
    </>
  );
}

function FilterChip({
  active,
  onClick,
  label,
  ja,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  ja?: string;
}) {
  return (
    <button
      type="button"
      className={`board-chip${active ? " board-chip-active" : ""}`}
      aria-pressed={active}
      onClick={onClick}
    >
      {label}
      {ja && (
        <span className="board-chip-ja" lang="ja">
          {ja}
        </span>
      )}
    </button>
  );
}
