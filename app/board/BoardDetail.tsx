"use client";

// The public detail surface for one board record (/board/?id=…). Records live in
// D1 (dynamic), so under `output: export` this is one static page that reads the
// id from the query string and fetches the single record via /api/search.
//
// It shows the owner's material and one owner-controlled action link. PX is not
// the seller/auctioneer/settler: the machine-readable boundary is shown plainly
// as part of the record — what PX does NOT do, stated as material.

import { useEffect, useState } from "react";
import { surfaceShapeLabel, intentLabel } from "@/lib/board/copy.ts";
import { BOARD_SEARCH_PATH } from "@/lib/board/href.ts";
import type { BoardRecordV1 } from "@/lib/board/types.ts";
import { BoardTransaction } from "./BoardTransaction";
import { ContactKit } from "./ContactKit";

type State =
  | { status: "loading" }
  | { status: "missing" }
  | { status: "ok"; record: BoardRecordV1 };

export function BoardDetail() {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("id");
    if (!id) {
      setState({ status: "missing" });
      return;
    }
    (async () => {
      try {
        const res = await fetch(`/api/search?recordId=${encodeURIComponent(id)}`);
        const body = (await res.json()) as { records?: BoardRecordV1[] };
        const record = body.records?.[0];
        setState(record ? { status: "ok", record } : { status: "missing" });
      } catch {
        setState({ status: "missing" });
      }
    })();
  }, []);

  if (state.status === "loading") return <p className="entries">Loading…</p>;
  if (state.status === "missing") {
    return (
      <p className="entries">
        Record not found.{" "}
        <a className="board-link" href={BOARD_SEARCH_PATH}>
          Back to the board →
        </a>
      </p>
    );
  }

  const r = state.record;
  return (
    <article className="board-detail">
      <p className="demo-banner" role="note">
        Sample board (demo) — not a real seller or contact.{" "}
        <span lang="ja">サンプルの板です（デモ）。実在の出品者・連絡先ではありません。</span>
      </p>
      <div className="board-detail-badges">
        <span className="listing-type">{surfaceShapeLabel(r.surfaceShape).en}</span>
        <span className="board-intent" lang="ja">
          {intentLabel(r.intent).ja} · {intentLabel(r.intent).en}
        </span>
        {r.category && <span className="board-detail-cat">{r.category}</span>}
        {r.region && <span className="board-detail-cat">{r.region}</span>}
      </div>

      <h1 className="title board-detail-title">{r.title}</h1>
      <p className="listing-sender">{r.ownerPublicRef}</p>

      {r.summary && <p className="board-detail-summary">{r.summary}</p>}

      {/* Contact Kit — device-side intro packet + owner-chosen external tool.
          PX holds no contact/message body and generates no contact link. */}
      <ContactKit
        record={{ recordId: r.recordId, title: r.title, externalActionUrl: r.externalActionUrl }}
      />

      {/* The machine-readable boundary, shown as material — what PX does not do. */}
      <dl className="board-boundary" aria-label="What PX does not do">
        <div>
          <dt>PX does not sell</dt>
          <dd>{r.machineReadableBoundary.pxDoesNotSell ? "true" : "false"}</dd>
        </div>
        <div>
          <dt>PX does not settle</dt>
          <dd>{r.machineReadableBoundary.pxDoesNotSettle ? "true" : "false"}</dd>
        </div>
        <div>
          <dt>PX does not recommend</dt>
          <dd>{r.machineReadableBoundary.pxDoesNotRecommend ? "true" : "false"}</dd>
        </div>
        <div>
          <dt>Owner controls the action</dt>
          <dd>{r.machineReadableBoundary.ownerControlsAction ? "true" : "false"}</dd>
        </div>
      </dl>

      <p className="board-record-id">
        record · <code>{r.recordId}</code>
      </p>

      <BoardTransaction recordId={r.recordId} />

      <p>
        <a className="board-link" href={BOARD_SEARCH_PATH}>
          ← Back to the board
        </a>
      </p>
    </article>
  );
}
