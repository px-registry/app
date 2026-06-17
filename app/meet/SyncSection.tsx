"use client";

// Device Mesh（内部名）／表層 Sync — 端末横断同期の UI 足場（緑2・2026-06-17）。
// 設計: docs/r2/device-mesh-how-v0.3.md。STOP-D 確定コピーのみ・モック状態。
//
// 本物には一切つながない:
//   - 鍵 / relay / 本番 schema / crypto 非接続（M-3: app/meet は I/O 禁止＝useState のみ）。
//   - 実 QR は device_enc pub＋pairing nonce の crypto＝赤。足場は placeholder の四角だけ。
//   - 順序材料を持たない・並べ替えない（M-4: .sort なし）＝「判定しない柱」を足場でも守る。
//   - 自分側の事実のみ（STOP-E）。相手の届いた/読んだ/入力中/オンライン/相手端末同期 は出さない。
// 文言はすべて MEET.sync 経由（インラインの日本語コピーを置かない）。
//
// 連結フロー（モックの状態機械・確定コピーで各面を見せる）:
//   idle → [端末をつなぐ] → qr（QR手引き）
//   qr  → [QRを表示] → approve（既存端末の承認の問い）／[復帰コードで戻る] → noDevice
//   approve → [追加する] → done(+一覧へ追加)／[やめる] → failed（承認未完了＝handoff失敗）
//   done → [AI接続へ](=#step-key)／[あとで] → idle
//   failed → [もう一度QRを表示] → qr
//   noDevice → [復帰コードで戻る]／[新しく始める] → idle
//   一覧: 各端末に 同期/同期しない トグル＋外す（二態）。この端末のトグルは pauseThis 確認を開く。

import { useCallback, useEffect, useState } from "react";
import { MEET } from "@/lib/meet/copy.ts";
import { ensureRegistered, loadDevices, revokeDevice } from "@/lib/meet-mesh/client.ts";

type MeshDevice = { id: string; label: string; here: boolean; syncing: boolean };
type Step = null | "qr" | "approve" | "done" | "failed" | "noDevice";

// モック初期端末（端末名・近接・時刻は実機では実データ。ここは確定コピーの例示値）。
const SEED: readonly MeshDevice[] = [
  { id: "d-here", label: "MacBook", here: true, syncing: true },
  { id: "d-phone", label: "iPhone", here: false, syncing: true },
];
const EXAMPLE_TIME = "今日 21:34"; // 動的（モック例示・場所は精密に出さない＝近接のみ）
const PENDING_LABEL = "MacBook"; // 追加候補（実機では QR/handoff 由来）

const panelStyle: React.CSSProperties = {
  marginTop: "var(--stack)",
  padding: "var(--space-2)",
  border: "1px solid var(--line)",
  borderRadius: "var(--radius-card)",
  background: "var(--card-face)",
};
const rowActions: React.CSSProperties = { display: "flex", gap: "0.5rem", marginTop: "var(--stack)" };
// QR placeholder（実 QR は crypto＝赤・足場は四角のみ）。
const qrBox: React.CSSProperties = {
  width: 120,
  height: 120,
  marginTop: "var(--space-1)",
  border: "1px dashed var(--line)",
  borderRadius: "var(--radius-card)",
  display: "grid",
  placeItems: "center",
  opacity: 0.6,
};

export function SyncSection() {
  const S = MEET.sync;
  const [devices, setDevices] = useState<MeshDevice[]>([...SEED]);
  const [step, setStep] = useState<Step>(null);
  const [removeTarget, setRemoveTarget] = useState<MeshDevice | null>(null);
  const [pauseOpen, setPauseOpen] = useState(false);
  // live = backend（local/dev）に身元があり、一覧が実機由来。fetch 不可（静的配信・本番非接続）
  // なら false のまま＝確定コピーの mock 足場を保つ（既存 ws-smoke はこの経路で green）。
  const [live, setLive] = useState(false);

  // 実機一覧へ差し替える（身元・backend があれば）。無ければ mock のまま（fail-closed）。
  const refresh = useCallback(async (): Promise<boolean> => {
    const list = await loadDevices();
    if (list !== null && list.length > 0) {
      setDevices(list.map((v) => ({ id: v.deviceId, label: v.label || v.deviceId, here: v.here, syncing: true })));
      setLive(true);
      return true;
    }
    return false;
  }, []);

  // 既に登録済み（前回 bootstrap 済み）の端末は、開いた時点で実機一覧を読む。
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const fallbackAdd = (): void =>
    setDevices((d) => [...d, { id: `d-${d.length}`, label: PENDING_LABEL, here: false, syncing: true }]);

  const addPending = (): void => {
    setStep("done");
    // 既定は同期の mock 追加（backend 非接続でも即反映・既存挙動を保つ）。
    fallbackAdd();
    // backend（local/dev）があれば、この端末を bootstrap（公開鍵だけ送る）→ 実機一覧へ差し替え。
    void (async () => {
      const id = await ensureRegistered(PENDING_LABEL);
      if (id !== null) await refresh();
    })();
  };
  const confirmPause = (): void => {
    // 同期の persistence opt-in（local）。relay の停止は Phase C。
    setDevices((d) => d.map((x) => (x.here ? { ...x, syncing: false } : x)));
    setPauseOpen(false);
  };
  const confirmRemove = (): void => {
    const target = removeTarget;
    setRemoveTarget(null);
    if (target === null) return;
    if (live) {
      // 実機: revoke+rotate（registry 側）→ 一覧を読み直す。
      void (async () => {
        const r = await revokeDevice(target.id);
        if (r.ok) await refresh();
      })();
      return;
    }
    setDevices((d) => d.filter((x) => x.id !== target.id));
  };

  return (
    <div className="m-card" id="step-sync" data-sync-scaffold="mock" data-sync-step={step ?? "idle"}>
      <h2 className="m-h2">{S.heading}</h2>

      <button type="button" className="m-btn" onClick={() => setStep("qr")}>
        {S.connect}
      </button>

      {/* noDevice（既存端末なし）面では一覧を隠す — 一覧との矛盾を避ける（Hiroto 確定）。 */}
      {step !== "noDevice" ? (
        <>
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
                {/* 同期状態は label「同期中」（旧「同期」ボタンは action に見えて弱い）。
                    この端末だけ、押すと「同期を止める」確認へ（pauseThis）。他端末は静的 label。 */}
                {dev.here ? (
                  <button
                    type="button"
                    className="m-btn m-btn-quiet m-sync-state"
                    style={{ whiteSpace: "nowrap" }}
                    onClick={() => setPauseOpen(true)}
                  >
                    {dev.syncing ? S.syncingLabel : S.syncOff}
                  </button>
                ) : (
                  <span className="m-badge m-sync-state" style={{ whiteSpace: "nowrap" }}>
                    {dev.syncing ? S.syncingLabel : S.syncOff}
                  </span>
                )}
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
        </>
      ) : null}

      {/* QR 手引き（この端末をつなぐ・確定コピー・mock） */}
      {step === "qr" ? (
        <div className="m-sync-panel" role="dialog" aria-label={S.qr.title} style={panelStyle}>
          <p className="m-h2" style={{ margin: 0 }}>
            {S.qr.title}
          </p>
          <p style={{ margin: "var(--space-1) 0 0" }}>{S.qr.body}</p>
          <div style={qrBox} aria-hidden="true">
            QR
          </div>
          <div style={rowActions}>
            <button type="button" className="m-btn m-btn-primary" onClick={() => setStep("approve")}>
              {S.qr.show}
            </button>
            <button type="button" className="m-btn m-btn-quiet" onClick={() => setStep("noDevice")}>
              {S.qr.recover}
            </button>
          </div>
        </div>
      ) : null}

      {/* 承認の問い（既存端末に出る確認・確定コピー・mock） */}
      {step === "approve" ? (
        <div className="m-sync-panel" role="dialog" aria-label={S.approve.title} style={panelStyle}>
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
            <button type="button" className="m-btn m-btn-quiet" onClick={() => setStep("failed")}>
              {S.approve.cancel}
            </button>
          </div>
          <p className="m-note" style={{ margin: "var(--space-1) 0 0" }}>
            {S.approve.warn}
          </p>
        </div>
      ) : null}

      {/* 接続完了（確定コピー・mock）— AIキー無しの分岐は常時併記（足場） */}
      {step === "done" ? (
        <div className="m-sync-panel" role="dialog" aria-label={S.done.title} style={panelStyle}>
          <p className="m-h2" style={{ margin: 0 }}>
            {S.done.title}
          </p>
          <p style={{ margin: "var(--space-1) 0 0" }}>{S.done.body}</p>
          <p className="m-note" style={{ margin: "var(--space-1) 0 0" }}>
            {S.done.noKey}
          </p>
          <div style={rowActions}>
            <a className="m-btn m-btn-primary" href="#step-key" onClick={() => setStep(null)}>
              {S.done.toKey}
            </a>
            <button type="button" className="m-btn m-btn-quiet" onClick={() => setStep(null)}>
              {S.done.later}
            </button>
          </div>
        </div>
      ) : null}

      {/* handoff 失敗（確定コピー・mock） */}
      {step === "failed" ? (
        <div className="m-sync-panel" role="dialog" aria-label={S.failed.title} style={panelStyle}>
          <p className="m-h2" style={{ margin: 0 }}>
            {S.failed.title}
          </p>
          <p style={{ margin: "var(--space-1) 0 0" }}>{S.failed.body}</p>
          <div style={rowActions}>
            <button type="button" className="m-btn m-btn-primary" onClick={() => setStep("qr")}>
              {S.failed.retry}
            </button>
          </div>
        </div>
      ) : null}

      {/* 既存端末が無い場合（確定コピー・mock） */}
      {step === "noDevice" ? (
        <div className="m-sync-panel" role="dialog" aria-label={S.noDevice.title} style={panelStyle}>
          <p className="m-h2" style={{ margin: 0 }}>
            {S.noDevice.title}
          </p>
          <p style={{ margin: "var(--space-1) 0 0" }}>{S.noDevice.body}</p>
          <div style={rowActions}>
            <button type="button" className="m-btn m-btn-quiet" onClick={() => setStep(null)}>
              {S.noDevice.recover}
            </button>
            <button type="button" className="m-btn m-btn-quiet" onClick={() => setStep(null)}>
              {S.noDevice.fresh}
            </button>
          </div>
        </div>
      ) : null}

      {/* 端末を外す（対象で二態・確定コピー・mock） */}
      {removeTarget ? (
        <div
          className="m-sync-panel"
          role="dialog"
          aria-label={removeTarget.here ? S.remove.thisTitle : S.remove.otherTitle(removeTarget.label)}
          style={panelStyle}
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

      {/* この端末の同期を止める（確定コピー・mock） */}
      {pauseOpen ? (
        <div className="m-sync-panel" role="dialog" aria-label={S.pauseThis.title} style={panelStyle}>
          <p className="m-h2" style={{ margin: 0 }}>
            {S.pauseThis.title}
          </p>
          <p style={{ margin: "var(--space-1) 0 0" }}>{S.pauseThis.body}</p>
          <div style={rowActions}>
            <button type="button" className="m-btn m-btn-danger" onClick={confirmPause}>
              {S.pauseThis.go}
            </button>
            <button type="button" className="m-btn m-btn-quiet" onClick={() => setPauseOpen(false)}>
              {S.pauseThis.cancel}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
