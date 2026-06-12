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

export function SignalsSection({
  inbox,
  outgoingPairs,
  firstNotes,
  poolRefs,
  onTalkBack,
  onClose,
  onSaveContact,
  onMakeFirstNote,
  onSaveFirstNote,
}: {
  inbox: InboxData | null;
  /** 便3: a 側の pair 面 — 自分が開いた edge が mutual（または mutual から閉じ）になったもの。 */
  outgoingPairs: InboxOutgoing[];
  /** c17: per-peer face data (basis + saved draft), owner-local only. */
  firstNotes: Record<string, FirstNoteFaceData>;
  /** c18b: refs currently in the pool (the 気配 fetch); null = couldn't tell. */
  poolRefs: ReadonlySet<string> | null;
  /** c18: the send result comes back — a refusal renders an honest line.
   *  R2 0010 T2: the answer addresses the EDGE that arrived (no reverse edge). */
  onTalkBack: (edgeId: string) => Promise<{ ok: boolean; code: string }>;
  /** 便3 T4/T5 — 閉じる（participant の行為のみ・結果は reload が運ぶ）。 */
  onClose: (edgeId: string) => Promise<{ ok: boolean; code: string }>;
  onSaveContact: (peerRef: string, note: string) => Promise<boolean>;
  /** 便4: 下書きは edge 単位（保存キー=edgeId・素材=peer）。 */
  onMakeFirstNote: (edgeId: string, peerRef: string) => Promise<string | null>;
  onSaveFirstNote: (edgeId: string, text: string) => Promise<void>;
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
            const theirNote =
              inbox?.notes.find((n) => n.fromRef === sig.fromRef)?.note ?? null;
            const myNote = inbox?.myNotes.find((n) => n.peerRef === sig.fromRef)?.note ?? "";
            const isMutual = sig.state === "mutual";
            const isClosed = sig.state === "closed";
            return (
              <li key={sig.edgeId} className={`m-signal${isMutual ? "" : " is-in"}`}>
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
            const theirNote =
              inbox?.notes.find((n) => n.fromRef === pair.toRef)?.note ?? null;
            const myNote = inbox?.myNotes.find((n) => n.peerRef === pair.toRef)?.note ?? "";
            const absent = poolRefs !== null && !poolRefs.has(pair.toRef);
            return (
              <li key={pair.edgeId} className="m-signal">
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
                    <details className="m-contactfold">
                      <summary>{MEET.firstNote.contactOpen}</summary>
                      <ContactExchange
                        peerRef={pair.toRef}
                        peerName={name}
                        myNote={myNote}
                        theirNote={theirNote}
                        onSave={onSaveContact}
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
