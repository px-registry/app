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
  getHiddenSignalRefs,
  addHiddenSignalRef,
  type InboxData,
  type InboxIncoming,
} from "@/lib/meet-net";
import { Ring } from "./Ring.tsx";

/** 相手の公開項目 (basis) resolved by the caller from the owner-local shelf. */
export type FirstNoteFaceData = {
  basis: { title: string; text: string } | null;
  draft: string;
};

function ContactExchange({
  peerRef,
  peerName,
  myNote,
  theirNote,
  onSave,
}: {
  peerRef: string;
  peerName: string;
  myNote: string;
  theirNote: string | null;
  onSave: (peerRef: string, note: string) => Promise<boolean>;
}) {
  const [note, setNote] = useState(myNote);
  const [state, setState] = useState<"idle" | "saved" | "failed">("idle");

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
            void onSave(peerRef, note.trim()).then((ok) => setState(ok ? "saved" : "failed"));
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
  sig,
  face,
  onMake,
  onSaveDraft,
}: {
  sig: InboxIncoming;
  face: FirstNoteFaceData;
  onMake: (peerRef: string) => Promise<string | null>;
  onSaveDraft: (peerRef: string, text: string) => Promise<void>;
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
    void onMake(sig.fromRef).then((draft) => {
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
    void onSaveDraft(sig.fromRef, text);
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
      {sig.anchor !== "" && <p className="m-pairline">{sig.anchor}</p>}
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

export function SignalsSection({
  inbox,
  firstNotes,
  poolRefs,
  onTalkBack,
  onSaveContact,
  onMakeFirstNote,
  onSaveFirstNote,
}: {
  inbox: InboxData | null;
  /** c17: per-peer face data (basis + saved draft), owner-local only. */
  firstNotes: Record<string, FirstNoteFaceData>;
  /** c18b: refs currently in the pool (the 気配 fetch); null = couldn't tell. */
  poolRefs: ReadonlySet<string> | null;
  /** c18: the send result comes back — a refusal renders an honest line. */
  onTalkBack: (toRef: string) => Promise<{ ok: boolean; code: string }>;
  onSaveContact: (peerRef: string, note: string) => Promise<boolean>;
  onMakeFirstNote: (peerRef: string) => Promise<string | null>;
  onSaveFirstNote: (peerRef: string, text: string) => Promise<void>;
}) {
  const t = useT();
  // c18 — 沈黙の禁止: こちらも話してみる の結末はこのカードに出る (keyed by peer).
  const [backNotes, setBackNotes] = useState<Record<string, string>>({});
  // c18b — 片づけた合図 (device-local list; loaded after mount, SSR-safe).
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());
  useEffect(() => {
    setHidden(new Set(getHiddenSignalRefs()));
  }, []);

  // 押す前から無いと分かる — 確信があるときだけ (pool照合不能ではマークしない).
  const absentOf = (sig: InboxIncoming): boolean =>
    poolRefs !== null && !poolRefs.has(sig.fromRef);
  // 片づけは「不在の残骸」だけを伏せる: 相手が pool に戻れば自動で再び見える
  // (箒が生きた相手を隠さない)。mutual は常に見える。
  const incoming = (inbox?.incoming ?? []).filter(
    (sig) => sig.mutual || !(hidden.has(sig.fromRef) && absentOf(sig)),
  );

  const sweep = (ref: string) => {
    setHidden(new Set(addHiddenSignalRef(ref)));
  };
  return (
    <section className="m-section">
      <p className="m-eyebrow">{MEET.home.signals.eyebrow}</p>
      <div className="m-secrow">
        <h2 className="m-h2">{MEET.home.signals.heading}</h2>
        <span className="m-badge">{incoming.length}</span>
      </div>
      <p className="m-note" style={{ margin: "0 0 0.5rem" }}>
        {MEET.home.signals.subnote}
      </p>
      {incoming.length === 0 ? (
        <div className="m-empty">{MEET.home.signals.empty}</div>
      ) : (
        <ul className="m-itemlist">
          {incoming.map((sig) => {
            const theirNote =
              inbox?.notes.find((n) => n.fromRef === sig.fromRef)?.note ?? null;
            const myNote = inbox?.myNotes.find((n) => n.peerRef === sig.fromRef)?.note ?? "";
            return (
              <li key={sig.fromRef} className={`m-signal${sig.mutual ? "" : " is-in"}`}>
                <div className="m-sighead">
                  {/* 輪が語る: open=相手は挙げた・あなたはまだ / pair=相互。
                      こちらも押すと弧が閉じて pair へ（~300ms; Ring.tsx）。
                      c9-5: 印なしの輪は状態記号サイズ=26。印あり=52 は R2 用の規約
                      （G-1=B: 今回の配布に印データは存在しない＝常に小輪）。 */}
                  <Ring state={sig.mutual ? "pair" : "open"} size={26} />
                  <h4>{MEET.home.signals.incoming(sig.fromName)}</h4>
                </div>
                {/* c17: in pair state the anchor moves INTO the face (接点の再掲,
                    same verbatim string) — shown here only pre-mutual. */}
                {!sig.mutual && sig.anchor !== "" && <p className="m-pairline">{sig.anchor}</p>}
                {/* c10: 判断材料 — 相手のひとこと紹介（owner自書き・公開済みの転載）。
                    式の下に引用の体で、ラベルなし・加工ゼロ（表示値=保存値）。
                    空なら行ごと出さない。 */}
                {sig.fromIntro.trim() !== "" && <p className="m-introline">{sig.fromIntro}</p>}
                {sig.mutual ? (
                  <>
                    <TalkFace
                      sig={sig}
                      face={firstNotes[sig.fromRef] ?? { basis: null, draft: "" }}
                      onMake={onMakeFirstNote}
                      onSaveDraft={onSaveFirstNote}
                    />
                    {/* c17: 連絡メモ交換は従属位置の fold へ — 中身は従来のまま */}
                    <details className="m-contactfold">
                      <summary>{MEET.firstNote.contactOpen}</summary>
                      <ContactExchange
                        peerRef={sig.fromRef}
                        peerName={sig.fromName}
                        myNote={myNote}
                        theirNote={theirNote}
                        onSave={onSaveContact}
                      />
                    </details>
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
                          void onTalkBack(sig.fromRef).then((r) =>
                            setBackNotes((prev) => ({
                              ...prev,
                              [sig.fromRef]: r.ok ? "" : r.code,
                            })),
                          )
                        }
                      >
                        {MEET.home.signals.talkBack}
                      </button>
                      {absentOf(sig) && (
                        // c18b: the broom — only on debris (a living card never
                        // shows it). Device-local hide; the server row stays.
                        <button
                          type="button"
                          className="m-btn m-btn-quiet"
                          onClick={() => sweep(sig.fromRef)}
                        >
                          {MEET.home.signals.sweep}
                        </button>
                      )}
                    </div>
                    {(backNotes[sig.fromRef] ?? "") !== "" && (
                      // c18: refusal lines — dead edge / missing name / honest error
                      <p className="m-note" aria-live="polite" style={{ color: "var(--shu-deep)" }}>
                        {backNotes[sig.fromRef] === "peer_not_in_pool" ? (
                          MEET.home.signals.notInPool
                        ) : backNotes[sig.fromRef] === "from_name" ? (
                          <>
                            {MEET.home.signals.nameFirst}{" "}
                            <Link className="m-rowlink" href="/meet/memory/#name">
                              {MEET.receive.nameWhere}
                            </Link>
                            。
                          </>
                        ) : (
                          MEET.receive.errors[backNotes[sig.fromRef]] ?? MEET.receive.errors.unknown
                        )}
                      </p>
                    )}
                    <p className="m-note">{MEET.proposal.mutualNote}</p>
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
