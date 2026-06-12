"use client";

// 合図 — signals addressed to me. One-sided by design: the sender moved first;
// I can move too (こちらも話してみる). When mutual, the contact-note exchange
// opens — my note goes to exactly this peer, and theirs appears here. The
// server refuses contact custody before mutuality (see functions/api/meet/
// contact.ts); this UI mirrors that rule rather than re-deciding it.
//
// c17 Handoff Lite — 相互の輪が閉じた直後の白紙を消す: the pair card leads
// with the 「この接点で話す」 face (anchor re-shown, the basis fold, an
// AI-drafted first note the owner rewrites and copies), and the contact-note
// exchange follows in a subordinate fold (連絡メモを開く). The draft lives
// ONLY on this device (firstnote lane); sending is copy → outside channel.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { MEET } from "@/lib/meet/copy.ts";
import { useT } from "@/lib/i18n/context.tsx";
import {
  getDismissedEdges,
  addDismissedEdge,
  type InboxData,
  type InboxIncoming,
  type InboxOutgoing,
} from "@/lib/meet-net";
import type { TalkEntryV1 } from "@/lib/meet-memory";
import { Ring } from "./Ring.tsx";

/** 相手の公開項目 (basis) resolved by the caller from the owner-local shelf. */
export type FirstNoteFaceData = {
  basis: { title: string; text: string } | null;
  draft: string;
};

function ContactExchange({
  edgeId,
  peerRef,
  peerName,
  myNote,
  theirNote,
  onSave,
  onDraft,
}: {
  /** 便6-3: 渡すは E2EE 封筒 — この edge を通って届く。 */
  edgeId: string;
  peerRef: string;
  peerName: string;
  myNote: string;
  theirNote: string | null;
  onSave: (edgeId: string, peerRef: string, note: string) => Promise<boolean>;
  /** R2 GOAL — Dock L3: 渡す文面の下書き（差し込み印つき・実行は owner の保存）。 */
  onDraft: (peerName: string) => Promise<string | null>;
}) {
  const [note, setNote] = useState(myNote);
  const [state, setState] = useState<"idle" | "saved" | "failed">("idle");
  const [drafting, setDrafting] = useState(false);
  const [draftFailed, setDraftFailed] = useState(false);

  const draft = () => {
    setDrafting(true);
    setDraftFailed(false);
    void onDraft(peerName).then((text) => {
      setDrafting(false);
      if (text === null) {
        setDraftFailed(true); // 欄の手書きは残る（L0 は常に生きている）
        return;
      }
      setNote(text);
      setState("idle");
    });
  };

  return (
    <div style={{ marginTop: "0.6rem" }}>
      <p className="m-accent">
        {MEET.home.signals.mutual} {MEET.home.signals.contactNote}
      </p>
      {theirNote !== null ? (
        <div className="m-proposal" style={{ marginBottom: "0.5rem" }}>
          <p className="m-item-tags" style={{ margin: 0 }}>
            {MEET.home.signals.theirNote(peerName)}
          </p>
          <p className="m-item-text" style={{ whiteSpace: "pre-wrap" }}>
            {theirNote}
          </p>
        </div>
      ) : (
        <p className="m-wait" style={{ margin: "0 0 0.5rem" }}>
          {MEET.home.signals.waitingNote}
        </p>
      )}
      <div style={{ display: "flex", gap: "0.4rem" }}>
        <input
          className="m-field"
          value={note}
          onChange={(e) => {
            setNote(e.target.value);
            setState("idle");
          }}
          placeholder={MEET.home.signals.contactPlaceholder}
        />
        <button
          type="button"
          className="m-btn m-btn-quiet"
          disabled={note.trim() === ""}
          onClick={() => {
            void onSave(edgeId, peerRef, note.trim()).then((ok) => setState(ok ? "saved" : "failed"));
          }}
        >
          {state === "saved" ? MEET.home.signals.contactSaved : MEET.home.signals.contactSave}
        </button>
      </div>
      {state === "failed" && (
        <p className="m-note" aria-live="polite" style={{ color: "var(--shu-deep)" }}>
          {MEET.receive.errors.network}
        </p>
      )}
      <button
        type="button"
        className="m-link"
        style={{ marginTop: "0.4rem" }}
        disabled={drafting}
        onClick={draft}
      >
        {drafting ? MEET.profile.introBusy : MEET.home.dock.draftAsk}
      </button>
      {draftFailed && (
        <p className="m-note" aria-live="polite" style={{ color: "var(--shu-deep)" }}>
          {MEET.firstNote.failed}
        </p>
      )}
    </div>
  );
}

// ── c17-1: 「この接点で話す」 — the face that opens when the pair closes ─────────
//
// Order (指示書 §1): eyebrow → 接点の再掲 (the anchor, verbatim — M-10 stays) →
// 相手の候補から (the ONE basis item, resolved upstream) → 最初の一言を作る →
// editable textarea → コピー → the assist line. The textarea is the always-open
// L0: hand-writing needs no AI, and a failed generation leaves it untouched.
function TalkFace({
  edgeId,
  peerRef,
  anchor,
  face,
  onMake,
  onSaveDraft,
}: {
  /** 便4: 下書きは edge に閉じる（鮮度原則）— 保存キーは edgeId、素材は peer。 */
  edgeId: string;
  /** 便3: incoming（fromRef）にも outgoing pair（toRef）にも同じ顔で立つ。 */
  peerRef: string;
  anchor: string;
  face: FirstNoteFaceData;
  onMake: (edgeId: string, peerRef: string) => Promise<string | null>;
  onSaveDraft: (edgeId: string, text: string) => Promise<void>;
}) {
  const [text, setText] = useState(face.draft);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [copied, setCopied] = useState<"idle" | "done" | "failed">("idle");
  const touched = useRef(false);
  const ta = useRef<HTMLTextAreaElement | null>(null);

  // the saved draft loads async (owner-local lane) — adopt it until first edit
  useEffect(() => {
    if (!touched.current) setText(face.draft);
  }, [face.draft]);

  const make = () => {
    setBusy(true);
    setFailed(false);
    void onMake(edgeId, peerRef).then((draft) => {
      setBusy(false);
      if (draft === null) {
        setFailed(true); // the textarea keeps the owner's words (L0 stays open)
        return;
      }
      touched.current = true;
      setText(draft);
    });
  };

  const save = () => {
    void onSaveDraft(edgeId, text);
  };

  const copy = () => {
    void navigator.clipboard
      .writeText(text)
      .then(() => setCopied("done"))
      .catch(() => {
        // clipboard refused — select the body so a hand copy is one keystroke,
        // and say so (no silent ending)
        ta.current?.select();
        setCopied("failed");
      });
  };

  return (
    <div className="m-talkface">
      <p className="m-eyebrow">{MEET.firstNote.eyebrow}</p>
      {anchor !== "" && <p className="m-pairline">{anchor}</p>}
      {face.basis !== null && (
        <details className="m-basis">
          <summary>{MEET.proposal.basisShow}</summary>
          <p className="m-item-text">
            {face.basis.title.trim() !== ""
              ? `${face.basis.title} — ${face.basis.text}`
              : face.basis.text}
          </p>
        </details>
      )}
      <button
        type="button"
        className="m-btn m-btn-primary"
        disabled={busy}
        onClick={make}
        style={{ marginTop: "0.5rem" }}
      >
        {busy ? MEET.profile.introBusy : MEET.firstNote.make}
      </button>
      {failed && (
        <p className="m-note" aria-live="polite" style={{ color: "var(--shu-deep)" }}>
          {MEET.firstNote.failed}
        </p>
      )}
      <textarea
        ref={ta}
        className="m-field"
        rows={4}
        value={text}
        onChange={(e) => {
          touched.current = true;
          setText(e.target.value);
          setCopied("idle");
        }}
        onBlur={save}
        style={{ marginTop: "0.5rem" }}
      />
      <button
        type="button"
        className="m-btn m-btn-quiet"
        disabled={text.trim() === ""}
        onClick={copy}
        style={{ marginTop: "0.4rem" }}
      >
        {copied === "done" ? MEET.intake.copied : MEET.firstNote.copyAction}
      </button>
      {copied === "failed" && (
        <p className="m-note" aria-live="polite" style={{ color: "var(--shu-deep)" }}>
          {MEET.intake.copyFailed}
        </p>
      )}
      <p className="m-note" style={{ margin: "0.4rem 0 0" }}>
        {MEET.firstNote.assist}
      </p>
    </div>
  );
}

// ── 便6: ノート — edge に立つ一枚（standing・一人一枚・編集は再封・spec §10/§13）。
// 自由文が床。読者の明示はゲート済の一行のみ — AI だけが読むように見せない。
function NoteFace({
  edgeId,
  peerRef,
  initial,
  onSave,
  onDraft,
}: {
  edgeId: string;
  peerRef: string;
  /** 自分が立てている現行ノート（端末転写・"" = まだ立てていない）。 */
  initial: string;
  onSave: (edgeId: string, peerRef: string, text: string) => Promise<{ ok: boolean; code: string }>;
  /** R2 GOAL — Dock L3: ノートの下書き（欄に入るだけ — 立てるのは owner の保存）。 */
  onDraft: (edgeId: string, peerRef: string) => Promise<string | null>;
}) {
  const [text, setText] = useState(initial);
  const [state, setState] = useState<"idle" | "saved" | "failed">("idle");
  const [failCode, setFailCode] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [draftFailed, setDraftFailed] = useState(false);
  const touched = useRef(false);

  // standing 転写は async に届く — 手を入れるまでは最新を映す（c17 と同じ規律）
  useEffect(() => {
    if (!touched.current) setText(initial);
  }, [initial]);

  const save = () => {
    void onSave(edgeId, peerRef, text.trim()).then((r) => {
      setState(r.ok ? "saved" : "failed");
      setFailCode(r.ok ? "" : r.code);
    });
  };

  const draft = () => {
    setDrafting(true);
    setDraftFailed(false);
    void onDraft(edgeId, peerRef).then((d) => {
      setDrafting(false);
      if (d === null) {
        setDraftFailed(true); // 欄の手書きは残る（L0 は常に生きている）
        return;
      }
      touched.current = true;
      setText(d);
      setState("idle");
    });
  };

  return (
    <details className="m-notefold">
      <summary>{MEET.home.talk.noteLabel}</summary>
      <div style={{ marginTop: "0.5rem" }}>
        <p className="m-note" style={{ margin: "0 0 0.4rem" }}>
          {MEET.home.talk.noteReaders}
        </p>
        <textarea
          className="m-field"
          rows={3}
          value={text}
          onChange={(e) => {
            touched.current = true;
            setText(e.target.value);
            setState("idle");
          }}
        />
        <button
          type="button"
          className="m-btn m-btn-quiet"
          style={{ marginTop: "0.4rem" }}
          disabled={text.trim() === ""}
          onClick={save}
        >
          {state === "saved" ? MEET.profile.saved : MEET.memory.save}
        </button>
        <button
          type="button"
          className="m-link"
          style={{ marginTop: "0.4rem", marginLeft: "0.6rem" }}
          disabled={drafting}
          onClick={draft}
        >
          {drafting ? MEET.profile.introBusy : MEET.home.dock.draftAsk}
        </button>
        {draftFailed && (
          <p className="m-note" aria-live="polite" style={{ color: "var(--shu-deep)" }}>
            {MEET.firstNote.failed}
          </p>
        )}
        {state === "failed" && (
          <p className="m-note" aria-live="polite" style={{ color: "var(--shu-deep)" }}>
            {MEET.receive.errors[failCode] ?? MEET.receive.errors.unknown}
          </p>
        )}
      </div>
    </details>
  );
}

// ── 便6: トーク — LINE/Slack の「形」を採り「圧」を採らない（spec §10）。
// 時系列・自他の整列・日付区切り・下書きの保全。既読・入力中・presence・
// 未読バッジは存在しない（このコンポーネントにその語彙がないことが pin）。
function dayOf(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

function TalkThread({
  edgeId,
  peerRef,
  entries,
  prefill,
  onSend,
}: {
  edgeId: string;
  peerRef: string;
  entries: TalkEntryV1[];
  /** R2 GOAL — チャットポートの下書きリンク（#draft=）から来た下書き。
   *  欄に入るだけ — 封緘も送信も owner の手（既存確認動線）。 */
  prefill?: string;
  onSend: (edgeId: string, peerRef: string, text: string) => Promise<{ ok: boolean; code: string }>;
}) {
  // 下書きの保全: 送信が失敗しても書いた文は欄に残る（沈黙の禁止＋床は紙）
  const [draft, setDraft] = useState(prefill ?? "");
  const [busy, setBusy] = useState(false);
  const [failCode, setFailCode] = useState("");
  // prefill が後から届いても、owner が書きかけた文は決して潰さない
  useEffect(() => {
    if (prefill !== undefined && prefill !== "") {
      setDraft((d) => (d === "" ? prefill : d));
    }
  }, [prefill]);

  const send = () => {
    const text = draft.trim();
    if (text === "" || busy) return;
    setBusy(true);
    setFailCode("");
    void onSend(edgeId, peerRef, text).then((r) => {
      setBusy(false);
      if (r.ok) {
        setDraft(""); // 成功したときだけ欄が空く
      } else {
        setFailCode(r.code); // 失敗は一行・下書きは残る
      }
    });
  };

  let lastDay = "";
  return (
    <div className="m-talk">
      {entries.map((e) => {
        const day = dayOf(e.at);
        const divider = day !== lastDay;
        lastDay = day;
        return (
          <div key={e.entryId}>
            {divider && <p className="m-talk-day">{day}</p>}
            {e.kind === "note-out" ? null : e.kind === "expired" ? (
              <p className="m-note" aria-live="polite">{MEET.home.talk.expired}</p>
            ) : e.kind === "keychange" ? (
              <p className="m-note">{MEET.home.talk.keyChanged}</p>
            ) : (
              <p
                className={`m-talk-msg ${e.kind === "out" || e.kind === "contact-out" ? "m-talk-out" : "m-talk-in"}`}
                style={{ whiteSpace: "pre-wrap" }}
              >
                {e.text}
              </p>
            )}
          </div>
        );
      })}
      <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.5rem" }}>
        <textarea
          className="m-field"
          rows={1}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={MEET.home.talk.placeholder}
        />
        <button
          type="button"
          className="m-btn m-btn-primary"
          disabled={draft.trim() === "" || busy}
          onClick={send}
        >
          {MEET.home.talk.send}
        </button>
      </div>
      {failCode !== "" && (
        <p className="m-note" aria-live="polite" style={{ color: "var(--shu-deep)" }}>
          {MEET.receive.errors[failCode] ?? MEET.receive.errors.unknown}
        </p>
      )}
    </div>
  );
}

export function SignalsSection({
  inbox,
  outgoingPairs,
  firstNotes,
  threads,
  peerNotes,
  poolRefs,
  portDraft,
  onTalkBack,
  onClose,
  onSendMessage,
  onSaveNote,
  onSaveContact,
  onMakeFirstNote,
  onSaveFirstNote,
  onDraftNote,
  onDraftContact,
}: {
  inbox: InboxData | null;
  /** 便3: a 側の pair 面 — 自分が開いた edge が mutual（または mutual から閉じ）になったもの。 */
  outgoingPairs: InboxOutgoing[];
  /** c17: per-peer face data (basis + saved draft), owner-local only. */
  firstNotes: Record<string, FirstNoteFaceData>;
  /** 便6: edge ごとのトーク（開封済み・時刻順・owner-local の棚から）。 */
  threads: Record<string, TalkEntryV1[]>;
  /** 便6: 相手の立てたノート（standing・開封済み）。 */
  peerNotes: Record<string, string>;
  /** c18b: refs currently in the pool (the 気配 fetch); null = couldn't tell. */
  poolRefs: ReadonlySet<string> | null;
  /** R2 GOAL — チャットポートの下書きリンク（one-shot・宛先 edge とその本文）。 */
  portDraft: { edgeId: string; text: string } | null;
  /** c18: the send result comes back — a refusal renders an honest line.
   *  R2 0010 T2: the answer addresses the EDGE that arrived (no reverse edge). */
  onTalkBack: (edgeId: string) => Promise<{ ok: boolean; code: string }>;
  /** 便3 T4/T5 — 閉じる（participant の行為のみ・結果は reload が運ぶ）。 */
  onClose: (edgeId: string) => Promise<{ ok: boolean; code: string }>;
  /** 便6 — トークの投函（端末で施錠・失敗は一行で返る）。 */
  onSendMessage: (edgeId: string, peerRef: string, text: string) => Promise<{ ok: boolean; code: string }>;
  /** 便6 — ノートを立てる・直す（standing・一人一枚・編集は再封）。 */
  onSaveNote: (edgeId: string, peerRef: string, text: string) => Promise<{ ok: boolean; code: string }>;
  onSaveContact: (edgeId: string, peerRef: string, note: string) => Promise<boolean>;
  /** 便4: 下書きは edge 単位（保存キー=edgeId・素材=peer）。 */
  onMakeFirstNote: (edgeId: string, peerRef: string) => Promise<string | null>;
  onSaveFirstNote: (edgeId: string, text: string) => Promise<void>;
  /** R2 GOAL — Dock L3: ノート・渡す文面の下書き（browser 直・実行は owner）。 */
  onDraftNote: (edgeId: string, peerRef: string) => Promise<string | null>;
  onDraftContact: (peerName: string) => Promise<string | null>;
}) {
  const t = useT();
  // c18 — 沈黙の禁止: こちらも話してみる の結末はこのカードに出る (keyed by edge).
  const [backNotes, setBackNotes] = useState<Record<string, string>>({});
  // 便4 — 片づけた閉じ札 (edge 単位・device-local; loaded after mount, SSR-safe).
  // c18b の hidden-signals（相手単位・不在のあいだだけ）は退場: 生きた残骸は
  // T4「閉じる」がサーバの事実として置き換え、箒は閉じた札にだけ出る。
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(new Set());
  useEffect(() => {
    setDismissed(new Set(getDismissedEdges()));
  }, []);

  // 押す前から無いと分かる — 確信があるときだけ (pool照合不能ではマークしない).
  const absentOf = (sig: InboxIncoming): boolean =>
    poolRefs !== null && !poolRefs.has(sig.fromRef);
  // 便3: 自分が sent 段階で閉じた edge は出さない（自分の行為 — 表示すら要らない）。
  // mutual から閉じたものは双方に「このトークは閉じられました。」が出る（裁定）。
  // 便4: 片づけた閉じ札は伏せる — 箒は closed にだけ効く（生きた札は対象外＝構造）。
  const incoming = (inbox?.incoming ?? []).filter(
    (sig) =>
      !(sig.state === "closed" && sig.closedByMe && sig.closedFrom !== "mutual") &&
      !(sig.state === "closed" && dismissed.has(sig.edgeId)),
  );

  const sweep = (edgeId: string) => {
    setDismissed(new Set(addDismissedEdge(edgeId)));
  };
  // 便3 — 閉じる の結末（沈黙の禁止: 失敗は一行で出る; 成功は reload が状態を変える）
  const [closeNotes, setCloseNotes] = useState<Record<string, string>>({});
  const close = (edgeId: string) =>
    void onClose(edgeId).then((r) =>
      setCloseNotes((prev) => ({ ...prev, [edgeId]: r.ok ? "" : r.code })),
    );
  const closeLine = (edgeId: string) =>
    (closeNotes[edgeId] ?? "") !== "" && (
      <p className="m-note" aria-live="polite" style={{ color: "var(--shu-deep)" }}>
        {MEET.receive.errors[closeNotes[edgeId]] ?? MEET.receive.errors.unknown}
      </p>
    );
  return (
    <section className="m-section">
      <p className="m-eyebrow">{MEET.home.signals.eyebrow}</p>
      <div className="m-secrow">
        <h2 className="m-h2">{MEET.home.signals.heading}</h2>
        <span className="m-badge">{incoming.length + outgoingPairs.length}</span>
      </div>
      <p className="m-note" style={{ margin: "0 0 0.5rem" }}>
        {MEET.home.signals.subnote}
      </p>
      {incoming.length === 0 && outgoingPairs.length === 0 ? (
        <div className="m-empty">{MEET.home.signals.empty}</div>
      ) : (
        <ul className="m-itemlist">
          {incoming.map((sig) => {
            // 便6-3: 渡すは E2EE が主・平文行は二重読み窓の legacy（カットオーバーで終い）
            const th = threads[sig.edgeId] ?? [];
            const theirNote =
              [...th].reverse().find((e) => e.kind === "contact-in")?.text ??
              inbox?.notes.find((n) => n.fromRef === sig.fromRef)?.note ??
              null;
            const myNote =
              [...th].reverse().find((e) => e.kind === "contact-out")?.text ??
              inbox?.myNotes.find((n) => n.peerRef === sig.fromRef)?.note ??
              "";
            const isMutual = sig.state === "mutual";
            const isClosed = sig.state === "closed";
            return (
              <li key={sig.edgeId} id={`room-${sig.edgeId}`} className={`m-signal${isMutual ? "" : " is-in"}`}>
                <div className="m-sighead">
                  {/* 輪が語る: open=相手は挙げた・あなたはまだ / pair=相互 /
                      resting=閉じ。c9-5: 印なしの輪は状態記号サイズ=26。 */}
                  <Ring state={isClosed ? "resting" : isMutual ? "pair" : "open"} size={26} />
                  {isClosed ? (
                    <h4>{sig.fromName}</h4>
                  ) : (
                    <h4>{MEET.home.signals.incoming(sig.fromName)}</h4>
                  )}
                </div>
                {/* 便3 — 閉じの一語（終わり方を語り分けない・理由なし）。
                    mutual からの閉じは双方に、sent 段階の閉じは行為しなかった側に。
                    便4 — 箒は閉じた札にだけ（生きた札に箒は出ない＝構造）。 */}
                {isClosed && (
                  <>
                    <p className="m-note" aria-live="polite" style={{ margin: "0.4rem 0 0" }}>
                      {sig.closedFrom === "mutual" ? MEET.home.edge.talkClosed : MEET.home.edge.stopped}
                    </p>
                    <button
                      type="button"
                      className="m-link"
                      style={{ marginTop: "0.3rem" }}
                      onClick={() => sweep(sig.edgeId)}
                    >
                      {MEET.home.signals.sweep}
                    </button>
                  </>
                )}
                {/* c17: in pair state the anchor moves INTO the face (接点の再掲,
                    same verbatim string) — shown here only pre-mutual. */}
                {!isMutual && !isClosed && sig.anchor !== "" && (
                  <p className="m-pairline">{sig.anchor}</p>
                )}
                {/* 便3 — dormant は読み時導出の事実（live のときだけ意味を持つ） */}
                {!isClosed && sig.dormant && (
                  <p className="m-note" style={{ margin: "0.4rem 0 0" }}>
                    {MEET.home.edge.dormant}
                  </p>
                )}
                {/* c10: 判断材料 — 相手のひとこと紹介（owner自書き・公開済みの転載）。
                    式の下に引用の体で、ラベルなし・加工ゼロ（表示値=保存値）。
                    空なら行ごと出さない。 */}
                {!isClosed && sig.fromIntro.trim() !== "" && (
                  <p className="m-introline">{sig.fromIntro}</p>
                )}
                {isClosed ? null : isMutual ? (
                  <>
                    {absentOf(sig) && (
                      // c18c: a pair whose peer left the pool says so here too
                      // (同一定数; 連絡メモ・c17面はそのまま — mutual は隠れず
                      // 箒も出ない: 不在条件は非mutual のまま変えない)
                      <p className="m-note" aria-live="polite" style={{ margin: "0.4rem 0 0" }}>
                        {MEET.home.signals.notInPool}
                      </p>
                    )}
                    <TalkFace
                      edgeId={sig.edgeId}
                      peerRef={sig.fromRef}
                      anchor={sig.anchor}
                      face={firstNotes[sig.edgeId] ?? { basis: null, draft: "" }}
                      onMake={onMakeFirstNote}
                      onSaveDraft={onSaveFirstNote}
                    />
                    {/* 便6: 相手の立てたノート（standing・読者明示はノート側 UI が担う） */}
                    {(peerNotes[sig.edgeId] ?? "") !== "" && (
                      <p className="m-introline" style={{ whiteSpace: "pre-wrap" }}>
                        {peerNotes[sig.edgeId]}
                      </p>
                    )}
                    {/* 便6: トーク — 素の往復が主（spec §10/§14） */}
                    <TalkThread
                      edgeId={sig.edgeId}
                      peerRef={sig.fromRef}
                      entries={threads[sig.edgeId] ?? []}
                      prefill={portDraft?.edgeId === sig.edgeId ? portDraft.text : undefined}
                      onSend={onSendMessage}
                    />
                    {/* 便6: 自分のノートを立てる・直す（standing の fold） */}
                    <NoteFace
                      edgeId={sig.edgeId}
                      peerRef={sig.fromRef}
                      initial={th.find((e) => e.kind === "note-out")?.text ?? ""}
                      onSave={onSaveNote}
                      onDraft={onDraftNote}
                    />
                    {/* c17: 連絡メモ交換は従属位置の fold へ — 便6-3 で E2EE 封筒に */}
                    <details className="m-contactfold">
                      <summary>{MEET.firstNote.contactOpen}</summary>
                      <ContactExchange
                        edgeId={sig.edgeId}
                        peerRef={sig.fromRef}
                        peerName={sig.fromName}
                        myNote={myNote}
                        theirNote={theirNote}
                        onSave={onSaveContact}
                        onDraft={onDraftContact}
                      />
                    </details>
                    {/* 便3 T5 — 双方が閉じられる（理由なし・一語の事実へ収束） */}
                    <button
                      type="button"
                      className="m-link"
                      style={{ marginTop: "0.5rem" }}
                      onClick={() => close(sig.edgeId)}
                    >
                      {MEET.home.edge.close}
                    </button>
                    {closeLine(sig.edgeId)}
                  </>
                ) : (
                  <>
                    <p className="m-wait">{t("meet.signal.notYet")}</p>
                    {absentOf(sig) && (
                      // c18b: the same line c18 answers with, BEFORE any press
                      // (同一定数 — never a second wording)
                      <p className="m-note" aria-live="polite" style={{ margin: "0.4rem 0 0" }}>
                        {MEET.home.signals.notInPool}
                      </p>
                    )}
                    <div className="m-respond">
                      <button
                        type="button"
                        className={`m-btn m-btn-wide ${absentOf(sig) ? "m-btn-quiet m-btn-dim" : "m-btn-primary"}`}
                        onClick={() =>
                          // R2 0010 T2: answer THIS edge — no reverse edge
                          void onTalkBack(sig.edgeId).then((r) =>
                            setBackNotes((prev) => ({
                              ...prev,
                              [sig.edgeId]: r.ok ? "" : r.code,
                            })),
                          )
                        }
                      >
                        {MEET.home.signals.talkBack}
                      </button>
                      {/* 便3 T4 — b の閉じ（自分の行為: 閉じた札は自分の列から消える）。
                          便4: 生きた残骸の箒はこれが代替 — サーバの事実で片づく。 */}
                      <button
                        type="button"
                        className="m-btn m-btn-quiet"
                        onClick={() => close(sig.edgeId)}
                      >
                        {MEET.home.edge.close}
                      </button>
                    </div>
                    {closeLine(sig.edgeId)}
                    {(backNotes[sig.edgeId] ?? "") !== "" && (
                      // c18: refusal lines — dead edge / missing name / honest error
                      <p className="m-note" aria-live="polite" style={{ color: "var(--shu-deep)" }}>
                        {backNotes[sig.edgeId] === "peer_not_in_pool" ? (
                          MEET.home.signals.notInPool
                        ) : backNotes[sig.edgeId] === "from_name" ? (
                          <>
                            {MEET.home.signals.nameFirst}{" "}
                            <Link className="m-rowlink" href="/meet/memory/#name">
                              {MEET.receive.nameWhere}
                            </Link>
                            。
                          </>
                        ) : (
                          MEET.receive.errors[backNotes[sig.edgeId]] ?? MEET.receive.errors.unknown
                        )}
                      </p>
                    )}
                    <p className="m-note">{MEET.proposal.mutualNote}</p>
                  </>
                )}
              </li>
            );
          })}
          {/* ── 便3: a 側の pair 面 — 自分が開いた接点が相互になったもの。
              旧世界では逆向き signal が incoming に立ったが、edge 世界では
              T2 が同じ edge を mutual にするので、a の前室はここで建つ。 ── */}
          {outgoingPairs
            .filter((pair) => !(pair.state === "closed" && dismissed.has(pair.edgeId)))
            .map((pair) => {
            const name = pair.toName !== "" ? pair.toName : pair.toRef;
            const isClosed = pair.state === "closed";
            const th = threads[pair.edgeId] ?? [];
            const theirNote =
              [...th].reverse().find((e) => e.kind === "contact-in")?.text ??
              inbox?.notes.find((n) => n.fromRef === pair.toRef)?.note ??
              null;
            const myNote =
              [...th].reverse().find((e) => e.kind === "contact-out")?.text ??
              inbox?.myNotes.find((n) => n.peerRef === pair.toRef)?.note ??
              "";
            const absent = poolRefs !== null && !poolRefs.has(pair.toRef);
            return (
              <li key={pair.edgeId} id={`room-${pair.edgeId}`} className="m-signal">
                <div className="m-sighead">
                  <Ring state={isClosed ? "resting" : "pair"} size={26} />
                  <h4>{name}</h4>
                </div>
                {isClosed ? (
                  // 便3 T5 — 双方に出る一語（理由なし）。便4 — 箒は閉じた札にだけ。
                  <>
                    <p className="m-note" aria-live="polite" style={{ margin: "0.4rem 0 0" }}>
                      {MEET.home.edge.talkClosed}
                    </p>
                    <button
                      type="button"
                      className="m-link"
                      style={{ marginTop: "0.3rem" }}
                      onClick={() => sweep(pair.edgeId)}
                    >
                      {MEET.home.signals.sweep}
                    </button>
                  </>
                ) : (
                  <>
                    <p className="m-accent" style={{ margin: "0.3rem 0 0" }}>
                      {MEET.home.signals.mutual}
                    </p>
                    {pair.dormant && (
                      <p className="m-note" style={{ margin: "0.4rem 0 0" }}>
                        {MEET.home.edge.dormant}
                      </p>
                    )}
                    {absent && (
                      // c18c 系譜: 相手がプールを離れていても前室は可達（同一定数）
                      <p className="m-note" aria-live="polite" style={{ margin: "0.4rem 0 0" }}>
                        {MEET.home.signals.notInPool}
                      </p>
                    )}
                    <TalkFace
                      edgeId={pair.edgeId}
                      peerRef={pair.toRef}
                      anchor={pair.anchor}
                      face={firstNotes[pair.edgeId] ?? { basis: null, draft: "" }}
                      onMake={onMakeFirstNote}
                      onSaveDraft={onSaveFirstNote}
                    />
                    {(peerNotes[pair.edgeId] ?? "") !== "" && (
                      <p className="m-introline" style={{ whiteSpace: "pre-wrap" }}>
                        {peerNotes[pair.edgeId]}
                      </p>
                    )}
                    <TalkThread
                      edgeId={pair.edgeId}
                      peerRef={pair.toRef}
                      entries={threads[pair.edgeId] ?? []}
                      prefill={portDraft?.edgeId === pair.edgeId ? portDraft.text : undefined}
                      onSend={onSendMessage}
                    />
                    <NoteFace
                      edgeId={pair.edgeId}
                      peerRef={pair.toRef}
                      initial={th.find((e) => e.kind === "note-out")?.text ?? ""}
                      onSave={onSaveNote}
                      onDraft={onDraftNote}
                    />
                    <details className="m-contactfold">
                      <summary>{MEET.firstNote.contactOpen}</summary>
                      <ContactExchange
                        edgeId={pair.edgeId}
                        peerRef={pair.toRef}
                        peerName={name}
                        myNote={myNote}
                        theirNote={theirNote}
                        onSave={onSaveContact}
                        onDraft={onDraftContact}
                      />
                    </details>
                    <button
                      type="button"
                      className="m-link"
                      style={{ marginTop: "0.5rem" }}
                      onClick={() => close(pair.edgeId)}
                    >
                      {MEET.home.edge.close}
                    </button>
                    {closeLine(pair.edgeId)}
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
