"use client";

// ワークスペース化(β) 第1便 — アンテナ面（探しにいく＋置いてある問い＋そっと置かれる
// 候補）。分解前 HomeView:1044-1352 のインライン JSX を**そのまま**持ち出した surface。
// 見た目ゼロ変化: 同じマークアップ・同じ .m-* クラス・同じ順序。値は context から取る
// （memory は露出しないので、問いの onBlur 保存だけ persistQuestion 経由に変えた）。

import Link from "next/link";
import { useState } from "react";
import { MEET } from "@/lib/meet/copy.ts";
import { toPublicView, type MeetRigItemV1 } from "@/lib/meet-memory";
import { snapshotHas } from "@/lib/meet-net";
import { Ring } from "../Ring.tsx";
import { useMeetWorkspace } from "../MeetWorkspaceContext.tsx";

// ── 置いてある問い — inline edit form (title/text only; the card stays a want) ──
function PlacedEdit({
  item,
  onSave,
  onCancel,
}: {
  item: MeetRigItemV1;
  onSave: (title: string, text: string) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(item.title);
  const [text, setText] = useState(item.text);
  return (
    <div className="m-form">
      <label className="m-note">{MEET.memory.titleLabel}</label>
      <input className="m-field" value={title} onChange={(e) => setTitle(e.target.value)} />
      <label className="m-note">{MEET.home.place.textLabel}</label>
      <textarea
        className="m-field"
        rows={2}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.6rem" }}>
        <button
          type="button"
          className="m-btn m-btn-primary"
          disabled={text.trim() === ""}
          onClick={() => onSave(title.trim(), text.trim())}
        >
          {MEET.memory.save}
        </button>
        <button type="button" className="m-btn m-btn-quiet" onClick={onCancel}>
          {MEET.memory.cancel}
        </button>
      </div>
    </div>
  );
}

export function AntennaSurface() {
  const {
    question,
    setQuestion,
    persistQuestion,
    qPlaceholder,
    connected,
    seekNote,
    setSeekNote,
    receive,
    gen,
    openPlace,
    placeDraft,
    setPlaceDraft,
    confirmPlace,
    ready,
    hasItems,
    displayName,
    participants,
    candidate,
    placeCandidate,
    dismissCandidate,
    placedEntries,
    editingPlaced,
    setEditingPlaced,
    savePlaced,
    setPlacedPrivate,
    removePlaced,
    snapshot,
    placedState,
    readsOf,
    poolStale,
    updatePool,
    poolBusy,
  } = useMeetWorkspace();

  return (
    <>
      <section className="m-section">
        {/* 第2手 ①: rail に既に Antenna があるので canvas の見出し反復を畳む——
            eyebrow「ASK」だけ残し、長い H2 反復は退ける（言葉を減らす・rail と一貫）。 */}
        <p className="m-eyebrow">{MEET.home.place.eyebrowAsk}</p>
        <textarea
          className="m-field m-composer"
          rows={2}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onBlur={persistQuestion}
          placeholder={qPlaceholder}
        />

        {/* 対ボタン［探しにいく］［アンテナを立てる］— 常設。未接続の探しにいくは
            offline 一行へ正直に倒す（沈黙の禁止・同一定数の再利用）。 */}
        <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}>
          <button
            type="button"
            className="m-btn m-btn-primary"
            style={{ flex: 1 }}
            onClick={() => {
              if (!connected) {
                setSeekNote(MEET.home.dockSearch.offline);
                return;
              }
              setSeekNote("");
              void receive();
            }}
            disabled={gen.phase === "busy"}
          >
            {gen.phase === "busy" ? MEET.receive.busy : MEET.home.receive}
          </button>
          <button
            type="button"
            className="m-btn m-btn-quiet"
            onClick={openPlace}
            disabled={question.trim() === "" || placeDraft !== null}
          >
            {MEET.home.place.action}
          </button>
        </div>
        {seekNote !== "" && (
          <p className="m-note" aria-live="polite">
            {seekNote}
          </p>
        )}
        {!ready && (
          <div className="m-empty" style={{ marginTop: "0.75rem", textAlign: "left" }}>
            {/* c12-4: each row carries its own 導線 — the key/memory rows land
                on their Setup step; the name row lands on Setup の呼び名カード
                (#name)（(a) 2026-06-16: 着地を Setup に揃えた・実体は Memory と共用）。 */}
            <ul style={{ margin: 0, paddingLeft: "1.2em" }}>
              {!connected && (
                <li>
                  <Link className="m-rowlink" href="/meet/start/#step-key">
                    {MEET.receive.needKey}
                  </Link>
                </li>
              )}
              {!hasItems && (
                <li>
                  <Link className="m-rowlink" href="/meet/start/#step-intake">
                    {MEET.receive.needMemory}
                  </Link>
                </li>
              )}
              {displayName === "" && (
                <li>
                  {/* (a)（Hiroto 確定 2026-06-16）: 文面が Setup と言う以上、着地も Setup へ。
                      Setup 内の呼び名カード（#name）は Memory と同じ store を共用。 */}
                  {MEET.receive.needName}{" "}
                  <Link className="m-rowlink" href="/meet/start/#name">
                    {MEET.receive.nameWhere}
                  </Link>
                </li>
              )}
            </ul>
            {!connected && (
              <p className="m-note" style={{ marginTop: "0.5rem" }}>
                {MEET.receive.noKeyLoop}
              </p>
            )}
            <p className="m-note" style={{ marginTop: "0.5rem" }}>
              <Link href="/meet/start/" style={{ color: "var(--shu-deep)" }}>
                {MEET.receive.toStart}
              </Link>
            </p>
          </div>
        )}
        {participants !== null && (
          <p className="m-note" aria-live="polite">
            {MEET.home.presence.participants(participants)}
          </p>
        )}
        {gen.phase === "error" && (
          // last resort only — every normal ending is an entry in the 欄 below
          <p className="m-note" aria-live="polite" style={{ color: "var(--shu-deep)" }}>
            {MEET.receive.errors[gen.code] ?? MEET.receive.errors.provider}
          </p>
        )}

        {placeDraft !== null && (
          <div className="m-card" style={{ marginTop: "0.75rem" }}>
            <p className="m-item-title" style={{ marginTop: 0 }}>
              {MEET.home.place.confirmHeading}
            </p>
            <p className="m-note">{MEET.home.place.confirmNote}</p>
            <div className="m-form">
              <label className="m-note">{MEET.home.place.titleLabel}</label>
              <input
                className="m-field"
                value={placeDraft.title}
                onChange={(e) => setPlaceDraft({ ...placeDraft, title: e.target.value })}
              />
              <label className="m-note">{MEET.home.place.textLabel}</label>
              <textarea
                className="m-field"
                rows={2}
                value={placeDraft.text}
                onChange={(e) => setPlaceDraft({ ...placeDraft, text: e.target.value })}
              />
              {/* 0012: チェック一個・説明文なし（公開性はこのカード自体が語済み） */}
              <label
                className="m-note"
                style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginTop: "0.5rem" }}
              >
                <input
                  type="checkbox"
                  checked={placeDraft.business}
                  onChange={(e) => setPlaceDraft({ ...placeDraft, business: e.target.checked })}
                />
                {MEET.home.place.business}
              </label>
              <div className="m-item-head" style={{ marginTop: "0.5rem" }}>
                <button
                  type="button"
                  className={`m-toggle ${placeDraft.private ? "" : "m-toggle-on"}`}
                  onClick={() => setPlaceDraft({ ...placeDraft, private: !placeDraft.private })}
                  aria-pressed={!placeDraft.private}
                >
                  {placeDraft.private ? MEET.intake.privateLabel : MEET.intake.publicLabel}
                </button>
              </div>
              <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.6rem" }}>
                <button
                  type="button"
                  className="m-btn m-btn-primary"
                  disabled={placeDraft.text.trim() === ""}
                  onClick={() => void confirmPlace()}
                >
                  {MEET.home.place.confirm}
                </button>
                <button
                  type="button"
                  className="m-btn m-btn-quiet"
                  onClick={() => setPlaceDraft(null)}
                >
                  {MEET.home.place.cancel}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 記憶装置 §0.6 — そっと置かれるアンテナ候補（一枚・薄く・通知ではない）。
            押せば place 二態へ・無視（×）すれば消える。圧の装置（既読/バッジ）なし。 */}
        {candidate !== null && placeDraft === null && (
          <div className="m-antcand">
            <div className="m-antcand-head">
              <span className="m-antcand-eyebrow">{MEET.home.antennaCandidate.eyebrow}</span>
              {candidate.implicit && (
                <span className="m-antcand-tag">{MEET.home.antennaCandidate.implicitTag}</span>
              )}
              <button
                type="button"
                className="m-antcand-x"
                onClick={dismissCandidate}
                aria-label={MEET.home.aiWindow.distillSkip}
              >
                ×
              </button>
            </div>
            <p className="m-antcand-text">{candidate.text}</p>
            {candidate.why !== "" && <p className="m-antcand-why">{candidate.why}</p>}
            <p className="m-note m-antcand-lead">{MEET.home.antennaCandidate.lead}</p>
            <div className="m-antcand-row">
              <button type="button" className="m-btn m-btn-primary" onClick={() => placeCandidate(candidate)}>
                {MEET.home.place.action}
              </button>
              <button type="button" className="m-btn m-btn-quiet" onClick={dismissCandidate}>
                {MEET.home.aiWindow.distillSkip}
              </button>
            </div>
          </div>
        )}
      </section>

      {placedEntries.length > 0 && (
        <section className="m-section">
          <p className="m-eyebrow">{MEET.home.place.eyebrowResting}</p>
          <div className="m-secrow">
            <h2 className="m-h2">{MEET.home.place.listHeading}</h2>
            <span className="m-badge">{placedEntries.length}</span>
          </div>
          {!connected && (
            <p className="m-note" style={{ margin: "0 0 0.5rem" }}>
              {MEET.home.patrol.offline}
            </p>
          )}
          <ul className="m-itemlist m-qlist">
            {placedEntries.map((e) => (
              <li key={e.entryId} className="m-q">
                <Ring
                  state="resting"
                  size={20}
                  className={`m-q-ring ${
                    e.item.private === false && snapshotHas(snapshot, toPublicView(e.item))
                      ? "is-wait"
                      : "is-idle"
                  }`}
                />
                <div className="m-q-body">
                {editingPlaced === e.entryId ? (
                  <PlacedEdit
                    item={e.item}
                    onSave={(title, text) => void savePlaced(e.entryId, e.item, title, text)}
                    onCancel={() => setEditingPlaced(null)}
                  />
                ) : (
                  <>
                    {e.item.title && <p className="m-item-title">{e.item.title}</p>}
                    <p className="m-item-text">{e.item.text}</p>
                    <p className="m-note" aria-live="polite">
                      <span
                        className={
                          placedState(e.item) === MEET.home.place.stateWaiting
                            ? "m-state-on"
                            : undefined
                        }
                      >
                        {placedState(e.item)}
                      </span>
                    </p>
                    {e.item.private === false &&
                      snapshotHas(snapshot, toPublicView(e.item)) &&
                      (() => {
                        const n = readsOf(e.item);
                        return n === null ? null : (
                          <p className="m-note" style={{ marginTop: "0.15rem" }}>
                            {n > 0 ? MEET.home.presence.reads(n) : MEET.home.presence.noReads}
                          </p>
                        );
                      })()}
                    <div className="m-item-actions">
                      <button
                        type="button"
                        className="m-link"
                        onClick={() => setEditingPlaced(e.entryId)}
                      >
                        {MEET.memory.edit}
                      </button>
                      {e.item.private === false ? (
                        <button
                          type="button"
                          className="m-link"
                          onClick={() => void setPlacedPrivate(e.entryId, e.item, true)}
                        >
                          {MEET.home.place.withdraw}
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="m-link"
                          onClick={() => void setPlacedPrivate(e.entryId, e.item, false)}
                        >
                          {MEET.home.place.putBack}
                        </button>
                      )}
                      <button
                        type="button"
                        className="m-link"
                        onClick={() => void removePlaced(e.entryId)}
                      >
                        {MEET.memory.remove}
                      </button>
                    </div>
                  </>
                )}
                </div>
              </li>
            ))}
          </ul>
          {poolStale &&
            (displayName !== "" ? (
              <button
                type="button"
                className="m-btn m-btn-quiet m-btn-wide"
                style={{ marginTop: "0.75rem" }}
                onClick={() => void updatePool()}
                disabled={poolBusy}
              >
                {MEET.home.place.updatePool}
              </button>
            ) : (
              <p className="m-note" style={{ marginTop: "0.75rem" }}>
                {MEET.home.place.needName}
              </p>
            ))}
        </section>
      )}
    </>
  );
}
