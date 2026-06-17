"use client";

// Device Mesh（内部名）／表層 Sync — 端末横断同期の UI 足場（緑2・2026-06-17）。
// 設計: docs/r2/device-mesh-how-v0.1.md（v0.2）。STOP-D 確定コピーのみ・モック状態。
//
// 本物には一切つながない:
//   - 鍵 / relay / 本番 schema / crypto 非接続（M-3: app/meet は I/O 禁止＝useState のみ）。
//   - 順序材料を持たない・並べ替えない（M-4: .sort なし）＝「判定しない柱」を足場でも守る。
//   - 自分側の事実のみ（STOP-E）。相手の届いた/読んだ/入力中/オンライン/相手端末同期 は出さない。
// 文言はすべて MEET.sync 経由（インラインの日本語コピーを置かない）。
//
// 保留（GPT 版 paste 待ち＝本コンポーネント未反映）:
//   QR 手引き / 接続完了 / handoff 失敗 / 既存端末なし / 「この端末の同期を止める」。
//   「端末をつなぐ」押下は、実機では QR→handoff を経て承認の問いへ至る。足場では QR 段を
//   省いて承認の問い（確定コピー）を直接見せる（モック）。全消去（wipe）は着地が Memory/Trust
//   のため、コピーは copy.ts に確定済・ここでは未配線。

import { useState } from "react";
import { MEET } from "@/lib/meet/copy.ts";

type MeshDevice = { id: string; label: string; here: boolean; syncing: boolean };

// モック初期端末（端末名・近接・時刻は実機では実データ。ここは確定コピーの例示値）。
const SEED: readonly MeshDevice[] = [
  { id: "d-here", label: "MacBook", here: true, syncing: true },
  { id: "d-phone", label: "iPhone", here: false, syncing: true },
];
const EXAMPLE_TIME = "今日 21:34"; // 動的（モック例示・場所は精密に出さない＝近接のみ）
const PENDING_LABEL = "MacBook"; // 追加候補（実機では QR/handoff 由来）

const modalStyle: React.CSSProperties = {
  marginTop: "var(--stack)",
  padding: "var(--space-2)",
  border: "1px solid var(--line)",
  borderRadius: "var(--radius-card)",
  background: "var(--card-face)",
};
const rowActions: React.CSSProperties = { display: "flex", gap: "0.5rem", marginTop: "var(--stack)" };

export function SyncSection() {
  const S = MEET.sync;
  const [devices, setDevices] = useState<MeshDevice[]>([...SEED]);
  const [approving, setApproving] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<MeshDevice | null>(null);

  const addPending = (): void => {
    setDevices((d) => [...d, { id: `d-${d.length}`, label: PENDING_LABEL, here: false, syncing: true }]);
    setApproving(false);
  };
  const toggleSync = (id: string): void =>
    setDevices((d) => d.map((x) => (x.id === id ? { ...x, syncing: !x.syncing } : x)));
  const confirmRemove = (): void => {
    if (removeTarget) setDevices((d) => d.filter((x) => x.id !== removeTarget.id));
    setRemoveTarget(null);
  };

  return (
    <div className="m-card" id="step-sync" data-sync-scaffold="mock">
      <h2 className="m-h2">{S.heading}</h2>

      <button type="button" className="m-btn" onClick={() => setApproving(true)}>
        {S.connect}
      </button>

      <h3 className="m-h2" style={{ marginTop: "var(--stack)" }}>
        {S.listHeading}
      </h3>
      <ul style={{ listStyle: "none", padding: 0, margin: "var(--space-1) 0 0" }}>
        {devices.map((dev) => (
          <li
            key={dev.id}
            className="m-sync-row"
            style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "var(--space-1) 0" }}
          >
            <span style={{ flex: 1, minWidth: 0 }}>
              {dev.label}
              {dev.here ? (
                <span className="m-badge" style={{ marginLeft: "0.5rem" }}>
                  {S.thisDevice}
                </span>
              ) : null}
            </span>
            <button
              type="button"
              className="m-btn m-btn-quiet"
              style={{ whiteSpace: "nowrap" }}
              onClick={() => toggleSync(dev.id)}
            >
              {dev.syncing ? S.syncOn : S.syncOff}
            </button>
            <button
              type="button"
              className="m-btn m-btn-quiet"
              style={{ whiteSpace: "nowrap" }}
              onClick={() => setRemoveTarget(dev)}
            >
              {S.remove.action}
            </button>
          </li>
        ))}
      </ul>

      {/* 承認の問い（既存端末に出る確認・確定コピー・モック） */}
      {approving ? (
        <div className="m-sync-modal" role="dialog" aria-label={S.approve.title} style={modalStyle}>
          <p className="m-h2" style={{ margin: 0 }}>
            {S.approve.title}
          </p>
          <p style={{ margin: "var(--space-1) 0 0", fontWeight: 600 }}>{PENDING_LABEL}</p>
          <p className="m-note" style={{ margin: 0 }}>
            {S.approve.proximity} ・ {EXAMPLE_TIME}
          </p>
          <p style={{ margin: "var(--space-1) 0 0" }}>{S.approve.body(PENDING_LABEL)}</p>
          <p className="m-note" style={{ margin: "var(--space-1) 0 0" }}>
            {S.approve.syncs}
          </p>
          <p className="m-note" style={{ margin: 0 }}>
            {S.approve.noSyncs}
          </p>
          <div style={rowActions}>
            <button type="button" className="m-btn m-btn-primary" onClick={addPending}>
              {S.approve.go}
            </button>
            <button type="button" className="m-btn m-btn-quiet" onClick={() => setApproving(false)}>
              {S.approve.cancel}
            </button>
          </div>
          <p className="m-note" style={{ margin: "var(--space-1) 0 0" }}>
            {S.approve.warn}
          </p>
        </div>
      ) : null}

      {/* 端末を外す（対象で二態・確定コピー・モック） */}
      {removeTarget ? (
        <div
          className="m-sync-modal"
          role="dialog"
          aria-label={removeTarget.here ? S.remove.thisTitle : S.remove.otherTitle(removeTarget.label)}
          style={modalStyle}
        >
          <p className="m-h2" style={{ margin: 0 }}>
            {removeTarget.here ? S.remove.thisTitle : S.remove.otherTitle(removeTarget.label)}
          </p>
          <p style={{ margin: "var(--space-1) 0 0" }}>
            {removeTarget.here ? S.remove.thisBody : S.remove.otherBody}
          </p>
          <div style={rowActions}>
            <button type="button" className="m-btn m-btn-danger" onClick={confirmRemove}>
              {S.remove.go}
            </button>
            <button type="button" className="m-btn m-btn-quiet" onClick={() => setRemoveTarget(null)}>
              {S.remove.cancel}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
