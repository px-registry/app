"use client";

// Device Mesh（内部名）／表層 Sync — UI便（2026-06-17）: 実機配線（local/dev・本番非接触）。
// 設計: docs/r2/device-mesh-how-v0.3.md §5/§7/§13。
//
// 配線（lib 経由・app/meet は fetch/indexedDB/localStorage を直接持たない）:
//   - client.ts: ensureRegistered / loadDevices / revokeDevice
//   - handoff.ts: startHandoffAsNewDevice（自分の QR テキスト）/ reviewIncomingQR（貼付 QR の検証）/
//                 approveAndSendHandoff（**承認後にだけ**封緘＋put）/ cancelHandoff
//   - sync.ts: wipeMine（全消去＝relay purge ＋ ローカル Talk/Memory clear）
//
// security（§5.3・confirm-gated seal）: 貼付→reviewIncomingQR（純粋な検証・封緘も put もしない）→
//   承認の問い（記述子確認）→ **[追加する] を押して初めて** approveAndSendHandoff（device-add＋封緘＋put）。
//   承認前に seal/put へ到達しない。封緘宛先は QR 内 encPub のみ（server 後取得鍵を信頼起点にしない）。
// 自分側の事実のみ（STOP-E）。文言は MEET.sync 経由。backend 不在なら mock 一覧に畳む（ws-smoke 維持）。

import { useCallback, useEffect, useState } from "react";
import { MEET } from "@/lib/meet/copy.ts";
import { ensureRegistered, loadDevices, revokeDevice } from "@/lib/meet-mesh/client.ts";
import {
  startHandoffAsNewDevice,
  reviewIncomingQR,
  approveAndSendHandoff,
  pollAndInstallHandoff,
  cancelHandoff,
  type HandoffQRV1,
} from "@/lib/meet-mesh/handoff.ts";

type MeshDevice = { id: string; label: string; here: boolean; syncing: boolean };
type Step = null | "qr" | "approve" | "done" | "failed" | "noDevice";

// backend 不在時の mock 一覧（確定コピーの足場・ws-smoke はこの経路）。
const SEED: readonly MeshDevice[] = [
  { id: "d-here", label: "MacBook", here: true, syncing: true },
  { id: "d-phone", label: "iPhone", here: false, syncing: true },
];
const EXAMPLE_TIME = "今日 21:34"; // 記述子の時刻（動的・場所は精密に出さない＝近接のみ）

const panelStyle: React.CSSProperties = {
  marginTop: "var(--stack)",
  padding: "var(--space-2)",
  border: "1px solid var(--line)",
  borderRadius: "var(--radius-card)",
  background: "var(--card-face)",
};
const rowActions: React.CSSProperties = { display: "flex", gap: "0.5rem", marginTop: "var(--stack)" };
const codeArea: React.CSSProperties = {
  width: "100%",
  minHeight: 96,
  marginTop: "var(--space-1)",
  fontFamily: "ui-monospace, monospace",
  fontSize: "11px",
  whiteSpace: "pre-wrap",
  wordBreak: "break-all",
};

export function SyncSection() {
  const S = MEET.sync;
  const [devices, setDevices] = useState<MeshDevice[]>([...SEED]);
  const [step, setStep] = useState<Step>(null);
  const [removeTarget, setRemoveTarget] = useState<MeshDevice | null>(null);
  const [pauseOpen, setPauseOpen] = useState(false);
  const [live, setLive] = useState(false);
  // capability（B）: サーバが mesh write を許すか。false なら「同期中」と言わない（嘘をつかない）。
  // 既定 true は mock 足場（backend 不在）用 — live 取得 or mesh_disabled で上書きする。
  const [writeActive, setWriteActive] = useState(true);
  // handoff フロー
  const [qrText, setQrText] = useState("");
  const [qrCopied, setQrCopied] = useState(false);
  const [pasted, setPasted] = useState("");
  const [pendingQr, setPendingQr] = useState<HandoffQRV1 | null>(null);
  const [qrErr, setQrErr] = useState("");
  const [receiveNote, setReceiveNote] = useState("");

  const refresh = useCallback(async (): Promise<boolean> => {
    const r = await loadDevices();
    if (r !== null && r.devices.length > 0) {
      // 同期状態は **server の writeAllowed** に従う（client 判断でない）— off なら「同期中」と出さない。
      const syncing = r.capability.writeAllowed;
      setWriteActive(syncing);
      setDevices(r.devices.map((v) => ({ id: v.deviceId, label: v.label || S.thisDevice, here: v.here, syncing })));
      setLive(true);
      return true;
    }
    return false;
  }, [S.thisDevice]);

  // 開いた時点で（passkey session があれば）この端末を owner として bootstrap → 実機一覧へ。
  // backend/ session 不在なら mock のまま（fail-closed）。mesh_disabled（mode off）は正直な off 状態を出す。
  useEffect(() => {
    void (async () => {
      const reg = await ensureRegistered("");
      if (reg.disabled) setWriteActive(false); // mode off — mock の「同期中」で誤魔化さない
      await refresh();
    })();
  }, [refresh]);

  // qr 画面に入ったら、この端末の QR テキスト（自分の鍵で署名）を作る。crypto はローカルのみ。
  useEffect(() => {
    if (step !== "qr" || qrText !== "") return;
    void (async () => {
      const r = await startHandoffAsNewDevice("");
      setQrText(r.qr);
    })();
  }, [step, qrText]);

  const openConnect = (): void => {
    setQrText("");
    setPasted("");
    setQrErr("");
    setPendingQr(null);
    setStep("qr");
  };

  const copyQr = (): void => {
    void navigator.clipboard?.writeText(qrText).then(
      () => {
        setQrCopied(true);
        setTimeout(() => setQrCopied(false), 2000);
      },
      () => undefined,
    );
  };

  // 貼付 QR を検証（純粋・封緘も put もしない）→ 記述子確認（承認の問い）へ。
  const reviewPasted = (): void => {
    setQrErr("");
    void (async () => {
      const qr = await reviewIncomingQR(pasted.trim());
      if (qr === null) {
        setQrErr(S.qr.invalid);
        return;
      }
      setPendingQr(qr);
      setStep("approve");
    })();
  };

  // 承認後にだけ封緘＋put（confirm-gated seal）。
  const approve = (): void => {
    if (pendingQr === null) {
      setStep("failed");
      return;
    }
    const qr = pendingQr;
    void (async () => {
      const r = await approveAndSendHandoff(qr);
      if (r.ok) {
        await refresh();
        setStep("done");
      } else {
        setStep("failed");
      }
    })();
  };

  // 新端末側: 既存端末の承認後、bundle を取り込む（pollAndInstallHandoff）。
  const receive = (): void => {
    setReceiveNote("");
    void (async () => {
      const r = await pollAndInstallHandoff();
      if (r.ok) {
        await refresh();
        setStep("done");
      } else {
        setReceiveNote(S.qr.waiting);
      }
    })();
  };

  const declineApprove = (): void => {
    const qr = pendingQr;
    setPendingQr(null);
    setStep(null);
    if (qr !== null) void cancelHandoff(qr.did);
  };

  const confirmPause = (): void => {
    setDevices((d) => d.map((x) => (x.here ? { ...x, syncing: false } : x)));
    setPauseOpen(false);
  };
  const confirmRemove = (): void => {
    const target = removeTarget;
    setRemoveTarget(null);
    if (target === null) return;
    if (live) {
      void (async () => {
        const r = await revokeDevice(target.id);
        if (r.ok) await refresh();
      })();
      return;
    }
    setDevices((d) => d.filter((x) => x.id !== target.id));
  };

  return (
    <div className="m-card" id="step-sync" data-sync-scaffold="wired" data-sync-step={step ?? "idle"}>
      <h2 className="m-h2">{S.heading}</h2>

      <button type="button" className="m-btn" onClick={openConnect}>
        {S.connect}
      </button>

      {step !== "noDevice" ? (
        <>
          <h3 className="m-h2" style={{ marginTop: "var(--stack)" }}>
            {S.listHeading}
          </h3>
          {/* MESH_WRITE off / allowlist 外: 「同期中」と言わず、正直な off 状態を own-side で出す（B）。 */}
          {!writeActive ? (
            <p className="m-note" data-sync-offstate style={{ margin: "var(--space-1) 0 0" }}>
              {S.offState}
            </p>
          ) : null}
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
                {dev.here ? (
                  <button
                    type="button"
                    className="m-btn m-btn-quiet m-sync-state"
                    style={{ whiteSpace: "nowrap" }}
                    onClick={() => setPauseOpen(true)}
                  >
                    {dev.syncing && writeActive ? S.syncingLabel : S.syncOff}
                  </button>
                ) : (
                  <span className="m-badge m-sync-state" style={{ whiteSpace: "nowrap" }}>
                    {dev.syncing && writeActive ? S.syncingLabel : S.syncOff}
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

      {/* QR 手引き — この端末の QR テキストを見せ（コピー可）、別端末の QR を貼って迎える（テキスト版・camera は後便）。 */}
      {step === "qr" ? (
        <div className="m-sync-panel" role="dialog" aria-label={S.qr.title} style={panelStyle}>
          <p className="m-h2" style={{ margin: 0 }}>
            {S.qr.title}
          </p>
          <p style={{ margin: "var(--space-1) 0 0" }}>{S.qr.body}</p>
          <textarea className="m-field" data-sync-qr readOnly value={qrText} style={codeArea} />
          <div style={rowActions}>
            <button type="button" className="m-btn m-btn-quiet" onClick={copyQr}>
              {qrCopied ? S.qr.copied : S.qr.copyAction}
            </button>
            <button type="button" className="m-btn m-btn-quiet" data-sync-receive onClick={receive}>
              {S.qr.receive}
            </button>
            <button type="button" className="m-btn m-btn-quiet" onClick={() => setStep("noDevice")}>
              {S.qr.recover}
            </button>
          </div>
          {receiveNote !== "" ? (
            <p className="m-note" style={{ margin: "var(--space-1) 0 0" }}>
              {receiveNote}
            </p>
          ) : null}

          <h3 className="m-h2" style={{ marginTop: "var(--stack)" }}>
            {S.qr.pasteTitle}
          </h3>
          <textarea
            className="m-field"
            data-sync-paste
            value={pasted}
            placeholder={S.qr.pastePlaceholder}
            onChange={(e) => setPasted(e.target.value)}
            style={codeArea}
          />
          {qrErr !== "" ? (
            <p className="m-note" style={{ margin: "var(--space-1) 0 0" }}>
              {qrErr}
            </p>
          ) : null}
          <div style={rowActions}>
            <button type="button" className="m-btn m-btn-primary" onClick={reviewPasted}>
              {S.qr.pasteConfirm}
            </button>
          </div>
        </div>
      ) : null}

      {/* 承認の問い（記述子確認）— ここまで来ても封緘していない。[追加する] で初めて封緘＋put。 */}
      {step === "approve" ? (
        <div className="m-sync-panel" role="dialog" aria-label={S.approve.title} style={panelStyle}>
          <p className="m-h2" style={{ margin: 0 }}>
            {S.approve.title}
          </p>
          {/* 記述子＝端末名（UA 導出 or fallback「新しい端末」）＋時刻。近接は owner-local に確信が無いので出さない。 */}
          <p style={{ margin: "var(--space-1) 0 0", fontWeight: 600 }}>{pendingQr?.name || S.newDevice}</p>
          <p className="m-note" style={{ margin: 0 }}>{EXAMPLE_TIME}</p>
          <p style={{ margin: "var(--space-1) 0 0" }}>{S.approve.body(pendingQr?.name || S.newDevice)}</p>
          <p className="m-note" style={{ margin: "var(--space-1) 0 0" }}>
            {S.approve.syncs}
          </p>
          <p className="m-note" style={{ margin: 0 }}>
            {S.approve.noSyncs}
          </p>
          <div style={rowActions}>
            <button type="button" className="m-btn m-btn-primary" onClick={approve}>
              {S.approve.go}
            </button>
            <button type="button" className="m-btn m-btn-quiet" onClick={declineApprove}>
              {S.approve.cancel}
            </button>
          </div>
          <p className="m-note" style={{ margin: "var(--space-1) 0 0" }}>
            {S.approve.warn}
          </p>
        </div>
      ) : null}

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

      {step === "failed" ? (
        <div className="m-sync-panel" role="dialog" aria-label={S.failed.title} style={panelStyle}>
          <p className="m-h2" style={{ margin: 0 }}>
            {S.failed.title}
          </p>
          <p style={{ margin: "var(--space-1) 0 0" }}>{S.failed.body}</p>
          <div style={rowActions}>
            <button type="button" className="m-btn m-btn-primary" onClick={openConnect}>
              {S.failed.retry}
            </button>
          </div>
        </div>
      ) : null}

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

      {/* 全消去（Memory と Talk）は Sync に置かない（端末管理に破壊操作を混ぜない・Hiroto 2026-06-17）。
          MEET.sync.wipe ＋ sync.ts wipeMine は保持し、Memory/Trust 側の別便で配線する。 */}
    </div>
  );
}
