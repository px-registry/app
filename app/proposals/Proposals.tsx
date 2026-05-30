"use client";

// Stage B+1 — the owner-side proposal surface (/proposals).
//
// Everything here runs on the owner's device: it reads owner-local memory, asks
// the NEUTRAL board (/api/search with allowlist params only — saved_filter, no
// owner-typed query auto-sent), and composes proposals client-side. Each proposal
// names the memory entry that grounds it (inspectable, no score). The agent never
// writes memory and never acts — the owner clicks through to a neutral listing or
// dismisses. PX recommends nothing.

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  composeProposals,
  memoryToSearchParams,
  allowlistToQueryString,
  reasonLabel,
  PROPOSAL_COPY,
  PROPOSAL_BOUNDARY,
  type ResultSet,
  type ProposalV1,
} from "@/lib/owner-agent/index.ts";
import { OwnerMemoryStore, describeSavedFilter, type OwnerMemoryV1 } from "@/lib/owner-memory/index.ts";
import { IndexedDbBackend } from "@/lib/owner-memory/indexeddb.ts";
import { boardDetailPath } from "@/lib/board/href.ts";
import type { BoardRecordV1 } from "@/lib/board/types.ts";

export function Proposals() {
  const store = useMemo(() => new OwnerMemoryStore(new IndexedDbBackend()), []);
  const [proposals, setProposals] = useState<ProposalV1[] | null>(null);
  const [memory, setMemory] = useState<OwnerMemoryV1[]>([]);
  const [titles, setTitles] = useState<Record<string, string>>({});
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const compose = useCallback(async () => {
    const mem = await store.list(); // read-only; the agent never writes memory
    setMemory(mem);

    const fetchSet = async (params: Record<string, never> | ReturnType<typeof memoryToSearchParams>, savedFilterId?: string): Promise<ResultSet | null> => {
      if (params === null) return null;
      const qs = allowlistToQueryString(params);
      try {
        const res = await fetch(`/api/search${qs ? `?${qs}` : ""}`);
        const body = (await res.json()) as { records?: BoardRecordV1[] };
        return { savedFilterId, params, listings: body.records ?? [] };
      } catch {
        return null;
      }
    };

    const sets: ResultSet[] = [];
    // The whole neutral board (no params) — gives interests something to match.
    const whole = await fetchSet({});
    if (whole) sets.push(whole);
    // Each saved_filter's neutral result set (query NOT auto-sent).
    for (const sf of mem.filter((m) => m.kind === "saved_filter")) {
      const set = await fetchSet(memoryToSearchParams(sf, { includeQuery: false }), sf.memoryId);
      if (set) sets.push(set);
    }

    const titleMap: Record<string, string> = {};
    for (const set of sets) for (const l of set.listings) titleMap[l.recordId] = (l as BoardRecordV1).title;
    setTitles(titleMap);
    setProposals(composeProposals(mem, sets));
  }, [store]);

  useEffect(() => {
    void compose();
  }, [compose]);

  const groundingText = useCallback(
    (p: ProposalV1): string => {
      const entry = memory.find((m) => m.memoryId === p.reason.memoryRef);
      if (!entry) return reasonLabel(p.reason).en;
      if (entry.kind === "interest") return `${reasonLabel(p.reason).en}: “${entry.value.label}”`;
      if (entry.kind === "saved_filter") return `${reasonLabel(p.reason).en}: ${describeSavedFilter(entry.value)}`;
      return reasonLabel(p.reason).en;
    },
    [memory],
  );

  const keyOf = (p: ProposalV1) => `${p.listingRecordId}|${p.reason.kind}|${p.reason.memoryRef}`;
  const visible = (proposals ?? []).filter((p) => !dismissed.has(keyOf(p)));

  return (
    <>
      <p className="board-action-note">{PROPOSAL_COPY.note.en}</p>

      {proposals === null ? (
        <p className="entries">Composing on your device…</p>
      ) : visible.length === 0 ? (
        <p className="board-action-note">{PROPOSAL_COPY.empty.en}</p>
      ) : (
        <ul className="listings prop-list">
          {visible.map((p) => (
            <li key={keyOf(p)}>
              <div className="prop-row">
                <a className="listing-main prop-main" href={boardDetailPath({ recordId: p.listingRecordId })}>
                  <span className="listing-title">{titles[p.listingRecordId] ?? p.listingRecordId}</span>
                  <span className="prop-reason">{groundingText(p)}</span>
                </a>
                <button
                  type="button"
                  className="mem-del"
                  aria-label="Dismiss"
                  onClick={() => setDismissed((d) => new Set(d).add(keyOf(p)))}
                >
                  dismiss
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <details className="mem-boundary">
        <summary>How these are made</summary>
        <ul>
          <li>Read from your on-device memory; the board is asked only with neutral filters.</li>
          <li>Your interests and notes are matched on your device and never sent to PX.</li>
          <li>PX ranks nothing. Your AI proposes; you decide.</li>
        </ul>
        <pre className="mem-boundary-json">{JSON.stringify(PROPOSAL_BOUNDARY, null, 2)}</pre>
      </details>
    </>
  );
}
