"use client";

// Stage B — the owner-local memory surface (/memory).
//
// Everything here happens on the owner's own device. The store is IndexedDB; PX
// stores none of it and never learns from behavior. read / edit / export / delete
// all run locally — Export downloads a JSON the owner keeps; Clear wipes the
// local store and calls no server. Wording stays thin-honest: no "AI learns you".

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  OwnerMemoryStore,
  OWNER_MEMORY_BOUNDARY,
  describeSavedFilter,
  savedFilterToSearchPath,
  isApplicableSavedFilter,
  type OwnerMemoryV1,
} from "@/lib/owner-memory/index.ts";
import { IndexedDbBackend } from "@/lib/owner-memory/indexeddb.ts";

export function MemoryManager() {
  const store = useMemo(() => new OwnerMemoryStore(new IndexedDbBackend()), []);
  const [entries, setEntries] = useState<OwnerMemoryV1[] | null>(null);
  const [interest, setInterest] = useState("");
  const [note, setNote] = useState("");

  const refresh = useCallback(async () => {
    setEntries(await store.list());
  }, [store]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const addInterest = useCallback(async () => {
    if (!interest.trim()) return;
    await store.create({ kind: "interest", provenance: "owner_written", value: { label: interest.trim() } });
    setInterest("");
    await refresh();
  }, [interest, store, refresh]);

  const addNote = useCallback(async () => {
    if (!note.trim()) return;
    await store.create({ kind: "note", provenance: "owner_written", value: { text: note.trim() } });
    setNote("");
    await refresh();
  }, [note, store, refresh]);

  const remove = useCallback(
    async (id: string) => {
      await store.remove(id);
      await refresh();
    },
    [store, refresh],
  );

  const clearAll = useCallback(async () => {
    if (!window.confirm("Erase all memory on this device? PX holds no copy.")) return;
    await store.clear();
    await refresh();
  }, [store, refresh]);

  const exportJson = useCallback(async () => {
    const dump = await store.exportAll();
    const blob = new Blob([JSON.stringify(dump, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "px-owner-memory.json";
    a.click();
    URL.revokeObjectURL(url);
  }, [store]);

  return (
    <>
      <p className="board-action-note">
        Your memory lives on this device. PX stores none of it and never learns from your behavior —
        the board is the same neutral surface for everyone.
      </p>

      <div className="mem-add">
        <div className="mem-add-row">
          <input
            className="board-search-input"
            value={interest}
            onChange={(e) => setInterest(e.target.value)}
            placeholder="An interest (a word you choose)…"
            aria-label="Add an interest"
          />
          <button type="button" className="board-chip" onClick={addInterest}>
            Add interest
          </button>
        </div>
        <div className="mem-add-row">
          <input
            className="board-search-input"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="A private note…"
            aria-label="Add a note"
          />
          <button type="button" className="board-chip" onClick={addNote}>
            Add note
          </button>
        </div>
        <p className="board-action-note mem-note-warn">
          Notes are saved only in this browser and are never sent to PX.
        </p>
      </div>

      <div className="mem-actions">
        <button type="button" className="board-chip" onClick={exportJson}>
          Export (JSON)
        </button>
        <button type="button" className="board-chip" onClick={clearAll}>
          Clear all
        </button>
        <a className="board-link" href="/proposals/">
          Your AI&rsquo;s suggestions →
        </a>
      </div>

      {entries === null ? (
        <p className="entries">Loading…</p>
      ) : entries.length === 0 ? (
        <p className="board-action-note">No memory yet. What you add stays on this device.</p>
      ) : (
        <ul className="listings mem-list">
          {entries.map((e) => (
            <li key={e.memoryId}>
              <div className="mem-entry">
                <span className="listing-type">{e.kind}</span>
                <span className="mem-entry-body">{summarize(e)}</span>
                {e.kind === "saved_filter" &&
                  (isApplicableSavedFilter(e.value) ? (
                    <a className="board-link" href={savedFilterToSearchPath(e.value)}>
                      apply →
                    </a>
                  ) : (
                    <span className="board-error">invalid (no longer a board filter)</span>
                  ))}
                <button type="button" className="mem-del" onClick={() => remove(e.memoryId)} aria-label="Delete">
                  ✕
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <details className="mem-boundary">
        <summary>What PX does (and does not) do here</summary>
        <ul>
          <li>PX stores no owner memory — it lives on your device.</li>
          <li>PX does not rank or recommend, and builds no interest graph.</li>
          <li>Clearing your browser data erases this — Export to keep a copy.</li>
        </ul>
        <pre className="mem-boundary-json">{JSON.stringify(OWNER_MEMORY_BOUNDARY, null, 2)}</pre>
      </details>
    </>
  );
}

function summarize(e: OwnerMemoryV1): string {
  switch (e.kind) {
    case "interest":
      return e.value.label;
    case "note":
      return e.value.text;
    case "preference":
      return Object.entries(e.value)
        .map(([k, v]) => `${k}: ${v}`)
        .join(" · ");
    case "saved_filter":
      return describeSavedFilter(e.value);
  }
}
