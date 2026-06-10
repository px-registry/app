"use client";

// R1.5 公開されているもの — the shared candidate pool, as served. Arrival order
// only (the list is rendered exactly as the server returned it; the meet gates
// ban .sort in this lane). Self items are excluded server-side and re-filtered
// in the client lane.

import { useCallback, useEffect, useMemo, useState } from "react";
import { MEET } from "@/lib/meet/copy.ts";
import {
  deriveParticipantRef,
  getOrMintOwnerToken,
  fetchPool,
  type PoolItemPublic,
} from "@/lib/meet-net";

type State =
  | { phase: "loading" }
  | { phase: "failed" }
  | { phase: "ready"; items: PoolItemPublic[] };

/** Group consecutive items of one participant under one heading (no reorder). */
function groupByOwner(
  items: PoolItemPublic[],
): Array<{ ownerRef: string; key: string; items: PoolItemPublic[] }> {
  const groups: Array<{ ownerRef: string; key: string; items: PoolItemPublic[] }> = [];
  for (const it of items) {
    const last = groups[groups.length - 1];
    if (last && last.key === it.participantRef) last.items.push(it);
    else groups.push({ ownerRef: it.ownerRef, key: it.participantRef, items: [it] });
  }
  return groups;
}

export function PoolView() {
  const [state, setState] = useState<State>({ phase: "loading" });

  const load = useCallback(async () => {
    setState({ phase: "loading" });
    const me = await deriveParticipantRef(getOrMintOwnerToken());
    const r = await fetchPool(me);
    if (r.ok) setState({ phase: "ready", items: r.items });
    else setState({ phase: "failed" });
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const groups = useMemo(
    () => (state.phase === "ready" ? groupByOwner(state.items) : []),
    [state],
  );

  return (
    <>
      <section className="m-section">
        <h1 className="m-h1">{MEET.pool.title}</h1>
        <p className="m-lede" style={{ fontSize: "0.92rem" }}>
          {MEET.pool.note}
        </p>

        {state.phase === "loading" && <div className="m-empty">{MEET.pool.loading}</div>}

        {state.phase === "failed" && (
          <div className="m-empty">
            <p style={{ margin: "0 0 0.6rem" }}>{MEET.pool.failed}</p>
            <button type="button" className="m-btn m-btn-quiet" onClick={() => void load()}>
              {MEET.pool.reload}
            </button>
          </div>
        )}

        {state.phase === "ready" && groups.length === 0 && (
          <div className="m-empty">{MEET.pool.empty}</div>
        )}

        {groups.map((g) => (
          <div key={g.key} style={{ marginBottom: "1.25rem" }}>
            <h2 className="m-h2" style={{ fontSize: "1rem" }}>
              {g.ownerRef}
            </h2>
            <ul className="m-itemlist">
              {g.items.map((it, i) => (
                <li key={i} className="m-item">
                  <div className="m-item-head">
                    <span className="m-chip">{MEET.kinds[it.kind] ?? it.kind}</span>
                  </div>
                  {it.title && <p className="m-item-title">{it.title}</p>}
                  <p className="m-item-text">{it.text}</p>
                  {it.tags.length > 0 && <p className="m-item-tags">{it.tags.join(" / ")}</p>}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <div className="m-boundary">
        <p>{MEET.boundary.memory}</p>
        <p>{MEET.boundary.order}</p>
      </div>
    </>
  );
}
