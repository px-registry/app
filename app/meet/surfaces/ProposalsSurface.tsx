"use client";

// ワークスペース化(β) 第1便 — 提案面（Dock 検索＋AIが見つけた提案＝届いた読み物）。
// 分解前 HomeView:1389-1517 のインライン JSX を**そのまま**持ち出した surface。見た目
// ゼロ変化: 同じマークアップ・同じ .m-* クラス・同じ順序。値は context から取る。

import { MEET } from "@/lib/meet/copy.ts";
import { useT } from "@/lib/i18n/context.tsx";
import { Ring } from "../Ring.tsx";
import { ProposalEntry } from "../ProposalEntry.tsx";
import { fmtHm } from "../format.ts";
import { useMeetWorkspace } from "../MeetWorkspaceContext.tsx";

export function ProposalsSurface() {
  const t = useT();
  const {
    connected,
    dockAsk,
    setDockAsk,
    dockNote,
    setDockNote,
    dockBuildPreview,
    dockPreview,
    dockRun,
    dockBusy,
    received,
    hasItems,
    lastPatrolAt,
    participants,
    cardEdges,
    poolRefs,
    talk,
    closeEdge,
    askYourAi,
    rigEntries,
    reading,
    removeEntry,
  } = useMeetWorkspace();

  return (
    <>
      {/* R2 GOAL — Dock L2: owner 向け検索。AIが読み、人間には提案と根拠で返す
          （人間向け他者一覧は出さない — 結果は既存の提案レーンに gate 済みで立つ）。 */}
      <section className="m-section">
        {/* 第2手 ①: Finds 面の見出しは一つ（下の結果 H2「Finds」）に集約。検索の入力は
            eyebrow＋説明文の静かな入口に畳む（長い H2「探してもらう」反復を退ける）。 */}
        <p className="m-eyebrow">{MEET.home.dockSearch.eyebrow}</p>
        <p className="m-note" style={{ margin: "0.2rem 0 0.5rem" }}>
          {MEET.home.dockSearch.note}
        </p>
        {connected ? (
          <>
            <textarea
              className="m-field"
              rows={2}
              value={dockAsk}
              onChange={(e) => {
                setDockAsk(e.target.value);
                setDockNote("");
              }}
              placeholder={MEET.home.dockSearch.placeholder}
            />
            {dockAsk.trim() !== "" && (
              <details
                style={{ marginTop: "0.4rem" }}
                onToggle={(e) => {
                  if ((e.target as HTMLDetailsElement).open) void dockBuildPreview();
                }}
              >
                <summary className="m-note" style={{ cursor: "pointer" }}>
                  {MEET.home.dockSearch.previewFold}
                </summary>
                {dockPreview !== null && dockPreview.ask === dockAsk.trim() ? (
                  <>
                    <pre
                      className="m-item-text"
                      style={{ whiteSpace: "pre-wrap", maxHeight: "14rem", overflow: "auto" }}
                    >
                      {dockPreview.bundle.prompt}
                    </pre>
                    <p className="m-note">{MEET.home.dock.previewNote}</p>
                  </>
                ) : (
                  <p className="m-note">{MEET.home.dock.previewLead}</p>
                )}
              </details>
            )}
            <button
              type="button"
              className="m-btn m-btn-primary"
              style={{ marginTop: "0.5rem" }}
              disabled={dockAsk.trim() === "" || dockBusy}
              onClick={() => void dockRun()}
            >
              {dockBusy ? MEET.home.dockSearch.busy : MEET.home.dockSearch.run}
            </button>
            {dockNote !== "" && (
              <p className="m-note" aria-live="polite" style={{ marginTop: "0.4rem" }}>
                {dockNote}
              </p>
            )}
          </>
        ) : (
          <p className="m-note">{MEET.home.dockSearch.offline}</p>
        )}
      </section>

      <section className="m-section">
        <p className="m-eyebrow">{MEET.home.proposals.eyebrow}</p>
        <div className="m-secrow">
          {/* 第2手 ①: 長い「AIが見つけた提案」を rail と一貫の短語「Finds」へ。 */}
          <h2 className="m-h2">{MEET.rail.finds}</h2>
          <span className="m-badge">{received.length}</span>
        </div>
        <p className="m-note" style={{ margin: "0 0 0.4rem" }}>
          {MEET.home.proposals.subnote}
        </p>
        {received.length === 0 ? (
          hasItems && lastPatrolAt !== "" ? (
            /* 「今日は無い」面 — 沈黙の禁止の一面。証拠（見回り時刻・気配）を添える。 */
            <section className="m-emptyface" aria-live="polite">
              <Ring state="resting" size={72} className="m-q-ring is-idle" />
              <h3>{t("meet.empty.title")}</h3>
              <p className="m-ev">
                {t("meet.empty.evPre")}
                <span className="mono">{fmtHm(lastPatrolAt)}</span>
                {t("meet.empty.evMid")}
                <br />
                {t("meet.empty.evRest")}
              </p>
              {participants !== null && (
                <div className="m-facts">
                  <span>
                    {t("meet.empty.herePre")}
                    <span className="mono">{participants}</span>
                    {t("meet.empty.herePost")}
                  </span>
                </div>
              )}
              <p className="m-next">{t("meet.empty.next")}</p>
            </section>
          ) : (
            <div className="m-empty">
              {hasItems ? MEET.home.proposals.emptyReady : MEET.home.proposals.emptyNoMemory}
            </div>
          )
        ) : (
          <>
            <p className="m-note" style={{ margin: "0 0 0.6rem" }}>
              {MEET.home.proposals.orderNote} {MEET.proposal.talkNote}
            </p>
            <ul className="m-itemlist">
              {received.map((entry) => (
                <ProposalEntry
                  key={entry.entryId}
                  entry={entry}
                  cardEdges={cardEdges}
                  poolRefs={poolRefs}
                  onTalk={talk}
                  onWithdraw={closeEdge}
                  onAskAi={connected ? askYourAi : null}
                  selfItems={rigEntries.map((e) => ({
                    kind: e.item.kind,
                    title: e.item.title,
                    text: e.item.text,
                  }))}
                  onReading={reading}
                  onRemove={removeEntry}
                />
              ))}
            </ul>
          </>
        )}
      </section>
    </>
  );
}
