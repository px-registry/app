"use client";

// R1.5 home — the loop's resting surface:
// 今日の問い → 提案を受け取る → 届いた提案（話してみる・読み）→ 合図 → 連絡のメモ.
//
// Receiving runs entirely on the owner's side: memory (private included, SELF
// only) + the served public pool + the question are composed by the FROZEN rig
// core, the owner's own model is called browser-direct with the owner's key,
// and the reply lands on the owner-local received shelf. PX runs no model.
// Each generation (and each reading) is mirrored to the TEST-DISCLOSED
// facilitator log — the disclosure line sits in the boundary block below.
// Entries render newest-first — a TIME order only.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { MEET } from "@/lib/meet/copy.ts";
import {
  openMeetMemory,
  openReceived,
  openFirstNotes,
  PLACED_QUESTION_TAG,
  draftPlacedQuestionTitle,
  isPlacedQuestion,
  toPublicView,
  type MeetRigItemV1,
  type ReceivedProposalV1,
  type ReadingV1,
} from "@/lib/meet-memory";
import {
  getOrMintOwnerToken,
  deriveParticipantRef,
  fetchPool,
  fetchInbox,
  sendSignal,
  saveContactNote,
  submitLog,
  buildOutboundProjection,
  publishProjection,
  getPublishedSnapshot,
  setPublishedSnapshot,
  projectionSnapshotJson,
  snapshotHas,
  getPatrolLastRun,
  getPatrolByQuestion,
  markPatrolRun,
  type InboxData,
} from "@/lib/meet-net";
import {
  getModel,
  getKey,
  getEndpoint,
  isConnected,
  buildMeetPrompt,
  toRigPoolWithRefs,
  parseProposalReply,
  generateProposals,
  pickPatrolTarget,
  anchorForRecipient,
  buildFirstNotePrompt,
  parseFirstNoteReply,
  firstNoteMaterialFor,
} from "@/lib/meet-ai";
import { pastedOutputEchoesPrivate, type RigOwnerV1 } from "@/lib/rig";
import { useT } from "@/lib/i18n/context.tsx";
import { ProposalEntry } from "./ProposalEntry.tsx";
import { SignalsSection, type FirstNoteFaceData } from "./SignalsSection.tsx";
import { BoundaryNote } from "./BoundaryNote.tsx";
import { Ring } from "./Ring.tsx";

// 第9便 A: endings live as ENTRIES now; under the button only the running
// indicator and the last-resort line (entry write itself failed) remain.
type GenState = { phase: "idle" } | { phase: "busy" } | { phase: "error"; code: string };
type RigEntry = { entryId: string; item: MeetRigItemV1 };
type PlaceDraft = { title: string; text: string; private: boolean };

function readingJson(entry: ReceivedProposalV1): string {
  return JSON.stringify({ echo: entry.echoFlag, cards: entry.readings });
}

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

function fmtHm(iso: string): string {
  const d = new Date(iso);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function HomeView() {
  const t = useT();
  const memory = useMemo(() => openMeetMemory(), []);
  const shelf = useMemo(() => openReceived(), []);
  // c17: 第一信の下書きレーン — edge 単位・端末のみ（serverへ送らない）
  const notesLane = useMemo(() => openFirstNotes(), []);

  const [question, setQuestion] = useState("");
  const [rigEntries, setRigEntries] = useState<RigEntry[]>([]);
  const [displayName, setDisplayName] = useState("");
  const [intro, setIntro] = useState("");
  const [connected, setConnected] = useState(false);
  const [received, setReceived] = useState<ReceivedProposalV1[]>([]);
  const [inbox, setInbox] = useState<InboxData | null>(null);
  // c17: per-pair face data (basis + saved draft) for 「この接点で話す」
  const [firstNotes, setFirstNotes] = useState<Record<string, FirstNoteFaceData>>({});
  const [gen, setGen] = useState<GenState>({ phase: "idle" });
  const [placeDraft, setPlaceDraft] = useState<PlaceDraft | null>(null);
  const [editingPlaced, setEditingPlaced] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState("");
  const [poolBusy, setPoolBusy] = useState(false);
  const [patrolBusy, setPatrolBusy] = useState(false);
  const [lastPatrolAt, setLastPatrolAt] = useState("");
  // 第9便 C — 気配: a count, never a list (M-6 stays).
  const [participants, setParticipants] = useState<number | null>(null);

  const reload = useCallback(async () => {
    setQuestion(await memory.getQuestion());
    setRigEntries(await memory.listRigItems());
    const profile = await memory.getProfile();
    setDisplayName(profile?.displayName.trim() ?? "");
    setIntro(profile?.intro?.trim() ?? "");
    setConnected(isConnected());
    setSnapshot(getPublishedSnapshot());
    const list = await shelf.list();
    list.reverse(); // newest first — arrival time, nothing else
    setReceived(list);
    const ib = await fetchInbox(getOrMintOwnerToken());
    setInbox(ib.ok ? ib : null);
    // c17: face data per mutual pair — basis from the owner-local shelf (the
    // same provenance gate the display uses), draft from the firstnote lane.
    const fn: Record<string, FirstNoteFaceData> = {};
    if (ib.ok) {
      for (const sig of ib.incoming) {
        if (!sig.mutual) continue;
        const m = firstNoteMaterialFor(sig.fromRef, list, sig.anchor);
        fn[sig.fromRef] = { basis: m.basis, draft: await notesLane.get(sig.fromRef) };
      }
    }
    setFirstNotes(fn);
    setLastPatrolAt(getPatrolLastRun());
    // 気配: how many participants are in the pool right now (count only)
    const me = await deriveParticipantRef(getOrMintOwnerToken());
    const poolNow = await fetchPool(me);
    setParticipants(poolNow.ok ? new Set(poolNow.items.map((it) => it.participantRef)).size : null);
  }, [memory, shelf, notesLane]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // c12-3: the 探しに行く gate re-derives from the CURRENT stored name whenever
  // this page comes back into view (bfcache restore / tab refocus) — a name
  // cleared on the memory page must hide the button here without a manual
  // reload. Display-state sync only; no data behaviour changes.
  useEffect(() => {
    const sync = () => {
      if (document.visibilityState === "visible") void reload();
    };
    window.addEventListener("pageshow", sync);
    document.addEventListener("visibilitychange", sync);
    return () => {
      window.removeEventListener("pageshow", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, [reload]);

  const hasItems = rigEntries.length > 0;
  const ready = connected && hasItems && displayName !== "";
  const sentRefs = useMemo(
    () => new Set((inbox?.outgoing ?? []).map((o) => o.toRef)),
    [inbox],
  );

  // ── 置いてある問い (the waiting hand: a want card tagged 問い) ────────────────
  const placedEntries = rigEntries.filter((e) => isPlacedQuestion(e.item));
  // Snapshot rows are PUBLIC VIEWS (what actually left) — compare like for like.
  const placedState = (item: MeetRigItemV1): string => {
    const inSnap = snapshotHas(snapshot, toPublicView(item));
    if (item.private === false) {
      return inSnap ? MEET.home.place.stateWaiting : MEET.home.place.stateNotOut;
    }
    return inSnap ? MEET.home.place.stateStillOut : MEET.home.place.stateDown;
  };
  // The pool needs an update when any placed question's publicness disagrees
  // with what was last pushed (not-yet-out, or withdrawn-but-still-out).
  const poolStale = placedEntries.some(
    (e) => (e.item.private === false) !== snapshotHas(snapshot, toPublicView(e.item)),
  );

  // 第9便 C — 今日この問いを読んだ AI の実数 (server's dedup'd daily count).
  // Position = the item's index in the outbound projection (what publish sent).
  const projRows = buildOutboundProjection(rigEntries.map((x) => toPublicView(x.item)));
  const readsOf = (item: MeetRigItemV1): number | null => {
    const v = toPublicView(item);
    const pos = projRows.findIndex(
      (p) =>
        p.kind === v.kind &&
        p.title === v.title &&
        p.text === v.text &&
        JSON.stringify(p.tags) === JSON.stringify(v.tags),
    );
    if (pos < 0) return null;
    return inbox?.questionReads.find((r) => r.position === pos)?.count ?? 0;
  };

  const openPlace = () => {
    const q = question.trim();
    if (q === "") return;
    setPlaceDraft({ title: draftPlacedQuestionTitle(q), text: q, private: false });
  };

  const confirmPlace = async () => {
    if (placeDraft === null || placeDraft.text.trim() === "") return;
    await memory.create({
      kind: "rig_item",
      provenance: "owner_written",
      value: {
        kind: "want",
        title: placeDraft.title.trim(),
        text: placeDraft.text.trim(),
        tags: [PLACED_QUESTION_TAG],
        private: placeDraft.private,
      },
    });
    setPlaceDraft(null);
    // The question moved onto the waiting list — leaving it in the 問い box
    // would feed it twice (问い block AND want card) on the next generation.
    setQuestion("");
    await memory.setQuestion("");
    await reload();
  };

  const savePlaced = async (entryId: string, item: MeetRigItemV1, title: string, text: string) => {
    await memory.update(entryId, { ...item, title, text });
    setEditingPlaced(null);
    await reload();
  };

  const setPlacedPrivate = async (entryId: string, item: MeetRigItemV1, priv: boolean) => {
    await memory.update(entryId, { ...item, private: priv });
    await reload();
  };

  const removePlaced = async (entryId: string) => {
    await memory.remove(entryId);
    await reload();
  };

  // Explicit owner action — same publish lane as the memory page (the frozen
  // rig-core gate filters private items; nothing publishes automatically).
  const updatePool = async () => {
    setPoolBusy(true);
    // Public views leave the device (候補に出すときの書き方 substituted).
    const items = buildOutboundProjection(rigEntries.map((e) => toPublicView(e.item)));
    const r = await publishProjection({
      ownerToken: getOrMintOwnerToken(),
      displayName,
      intro,
      items,
    });
    if (r.ok) {
      const json = projectionSnapshotJson(items);
      setPublishedSnapshot(json);
      setSnapshot(json);
    }
    setPoolBusy(false);
  };

  // 第9便 A — every ending of a run (cards / 今日は無い / pool-empty / honest
  // error) lands as a DATED ENTRY at the top of AIが見つけた提案. 第8便's
  // 沈黙の禁止 continues: should even the entry write fail, the thrown error
  // surfaces as the last-resort line under the button.
  const runGeneration = async (
    q: string,
    via: "manual" | "patrol",
    patrolMeta?: { title: string },
  ) => {
    const base = {
      question: q.trim(),
      modelLabel: "",
      raw: "",
      cards: [],
      refs: {},
      echoFlag: false,
      via,
      ...(via === "patrol" ? { patrolQuestion: patrolMeta?.title ?? "" } : {}),
    };
    try {
      const items = (await memory.listRigItems()).map((e) => e.item);
      const self: RigOwnerV1 = { ownerId: "self", items };
      const me = await deriveParticipantRef(getOrMintOwnerToken());
      const poolRes = await fetchPool(me);
      if (!poolRes.ok) {
        await shelf.add({ ...base, outcome: "error", errorCode: "pool" });
        return;
      }
      // 第3便 A: an empty pool means there is nobody to propose — don't run
      // the model at all (a weak model invents partners; rule 7 is backed).
      if (poolRes.items.length === 0) {
        await shelf.add({ ...base, outcome: "pool-empty" });
        return;
      }
      const refs: Record<string, string> = {};
      const intros: Record<string, string> = {};
      for (const it of poolRes.items) {
        if (!(it.ownerRef in refs)) refs[it.ownerRef] = it.participantRef;
        if (!(it.ownerRef in intros)) intros[it.ownerRef] = it.ownerIntro;
      }
      // 第7便 C: stable [p◯] refs ride the prompt; the same map is captured on
      // the entry so the gate + 「相手の候補から」 can resolve basisItemId.
      const { pool, basis } = toRigPoolWithRefs(poolRes.items);
      const prompt = buildMeetPrompt(self, pool, q);
      const model = getModel();
      const r = await generateProposals({
        model,
        apiKey: model.provider === "ollama" ? "" : getKey(model.provider),
        endpoint: getEndpoint(),
        prompt,
      });
      if (!r.ok) {
        await shelf.add({ ...base, outcome: "error", errorCode: r.error });
        return;
      }
      const entry = await shelf.add({
        ...base,
        modelLabel: model.label,
        raw: r.text,
        cards: parseProposalReply(r.text),
        refs,
        basisItems: basis,
        intros,
        echoFlag: pastedOutputEchoesPrivate(self, r.text),
      });
      // Test-disclosed mirror (the boundary block below says so). Best-effort —
      // a network miss here never blocks the owner's own loop.
      void submitLog({
        ownerToken: getOrMintOwnerToken(),
        clientEntryId: entry.entryId,
        displayName,
        question: entry.question,
        proposalText: entry.raw,
        reading: readingJson(entry),
      });
    } catch {
      // even the unexpected becomes an honest entry; if THAT fails, rethrow
      // so the caller's last-resort line appears (no fourth, silent ending).
      const recorded = await shelf
        .add({ ...base, outcome: "error", errorCode: "unknown" })
        .then(() => true)
        .catch(() => false);
      if (!recorded) throw new Error("unrecordable");
    }
  };

  const receive = async () => {
    setGen({ phase: "busy" });
    try {
      await memory.setQuestion(question);
      await runGeneration(question, "manual");
      setGen({ phase: "idle" });
    } catch {
      setGen({ phase: "error", code: "unknown" });
    }
    await reload();
  };

  // ── 第9便 B — 見回り: once per page open, at most every 6h, oldest placed
  // question first; the owner's device and key only (PX runs nothing). ──────
  const patrolGuard = useRef(false);
  useEffect(() => {
    if (patrolGuard.current) return;
    patrolGuard.current = true;
    void (async () => {
      const rigList = await memory.listRigItems();
      const placedQs = rigList
        .filter((e) => isPlacedQuestion(e.item) && e.item.private === false)
        .map((e) => ({ entryId: e.entryId, title: e.item.title, text: e.item.text }));
      const target = pickPatrolTarget({
        connected: isConnected(),
        questions: placedQs,
        lastRunGlobal: getPatrolLastRun(),
        lastRunByQuestion: getPatrolByQuestion(),
        now: new Date().toISOString(),
      });
      if (target === null) return;
      // condition: a pool with nobody in it doesn't patrol (no model, no entry)
      const me = await deriveParticipantRef(getOrMintOwnerToken());
      const probe = await fetchPool(me);
      if (!probe.ok || probe.items.length === 0) return;
      // throttle stamps FIRST — a failing patrol must not retry on every open
      markPatrolRun(target.question.entryId, new Date().toISOString());
      setPatrolBusy(true);
      try {
        await runGeneration(target.question.text, "patrol", { title: target.question.title });
      } catch {
        /* the last-resort path needs the button context; patrol stays quiet
           in the header but its error entry was attempted above */
      }
      setPatrolBusy(false);
      setLastPatrolAt(getPatrolLastRun());
      await reload();
    })();
  }, [memory, reload]);

  // c11/c13: the anchor leaves this device RECIPIENT-addressed — the sender
  // recomposes their own 式 (あなた=送り手 → あなた=受け手) before sending.
  // v3 puts the 式 on line2 (line1 is the 言い切り); v2 stock had it on line1 —
  // staged search, and a parse miss falls back to the verbatim head
  // (fail-close, never blocks). The receiver renders verbatim (M-10).
  //
  // c18: the RESULT is read and returned — a refused signal (withdrawn peer,
  // missing name) must not wear a success face. The sent state stays server-
  // truth: a refusal writes no outgoing row, so no card flips.
  const talk = async (
    toRef: string,
    line1: string,
    line2: string,
    to: string,
  ): Promise<{ ok: boolean; code: string }> => {
    const anchor = anchorForRecipient(line1, line2, to, displayName);
    const r = await sendSignal({ ownerToken: getOrMintOwnerToken(), toRef, fromName: displayName, anchor });
    await reload();
    return r.ok ? { ok: true, code: "" } : { ok: false, code: r.error };
  };

  const talkBack = async (toRef: string): Promise<{ ok: boolean; code: string }> => {
    const r = await sendSignal({ ownerToken: getOrMintOwnerToken(), toRef, fromName: displayName, anchor: "" });
    await reload();
    return r.ok ? { ok: true, code: "" } : { ok: false, code: r.error };
  };

  const saveContact = async (peerRef: string, note: string): Promise<boolean> => {
    const r = await saveContactNote({ ownerToken: getOrMintOwnerToken(), peerRef, note });
    if (r.ok) await reload();
    return r.ok;
  };

  // ── c17: 第一信 — owner の鍵・owner の端末でだけ生成し、端末にだけ残す ────────
  // The send is copy → outside channel; nothing here calls lib/meet-net.
  const makeFirstNote = async (peerRef: string): Promise<string | null> => {
    const anchor = inbox?.incoming.find((s) => s.fromRef === peerRef)?.anchor ?? "";
    const m = firstNoteMaterialFor(peerRef, received, anchor);
    const model = getModel();
    const r = await generateProposals({
      model,
      apiKey: model.provider === "ollama" ? "" : getKey(model.provider),
      endpoint: getEndpoint(),
      prompt: buildFirstNotePrompt({ ...m, ownerName: displayName, ownerIntro: intro }),
    });
    if (!r.ok) return null;
    const text = parseFirstNoteReply(r.text);
    if (text === null) return null; // 空出力も正直なエラー一行へ（fail-close）
    await notesLane.save(peerRef, text); // reload しても下書きが残る
    setFirstNotes((prev) => ({ ...prev, [peerRef]: { basis: m.basis, draft: text } }));
    return text;
  };

  const saveFirstNote = async (peerRef: string, text: string): Promise<void> => {
    await notesLane.save(peerRef, text);
    setFirstNotes((prev) => ({
      ...prev,
      [peerRef]: { basis: prev[peerRef]?.basis ?? null, draft: text },
    }));
  };

  // 補遺 D: auto-saved readings report honestly — 「記録しました」 may be said
  // only when BOTH the local shelf write and the test-record mirror landed.
  const reading = async (entryId: string, cardIndex: number, value: ReadingV1): Promise<boolean> => {
    try {
      await shelf.setReading(entryId, cardIndex, value);
    } catch {
      return false;
    }
    const list = await shelf.list();
    const entry = list.find((e) => e.entryId === entryId);
    let recorded = false;
    if (entry) {
      const r = await submitLog({
        ownerToken: getOrMintOwnerToken(),
        clientEntryId: entry.entryId,
        displayName,
        question: entry.question,
        proposalText: entry.raw,
        reading: readingJson(entry),
      });
      recorded = r.ok;
    }
    list.reverse();
    setReceived(list);
    return recorded;
  };

  const removeEntry = async (entryId: string) => {
    await shelf.remove(entryId);
    await reload();
  };

  return (
    <>
      {/* 視覚一新: hero — 題字は新ヒーローへ、旧の題字文言は縦の銘に座る。
          傍点はヒーローの「誰もいない」のみ。<br> は640px未満で消える。 */}
      <section className="m-hero">
        <h1>
          {t("meet.hero.lead")}
          <br />
          <span className="m-shu">
            {t("meet.hero.accentPre")}
            <em>{t("meet.hero.accentEm")}</em>
            {t("meet.hero.accentPost")}
          </span>
        </h1>
        <p className="m-hero-sub">{t("meet.hero.sub")}</p>
        {/* 縦の銘は c9-1 で撤去（Hiroto 指摘「縦書きは過剰」） */}
        {/* 計器行 — the patrol fact moved here from the proposals column */}
        <div className="m-meter" role="status">
          <span className="m-live">
            <span className="m-pulse" aria-hidden="true" />
            {patrolBusy ? (
              MEET.home.patrol.running
            ) : lastPatrolAt !== "" ? (
              <span>
                {t("meet.meter.lastPre")}
                <span className="mono">{fmtHm(lastPatrolAt)}</span>
              </span>
            ) : (
              t("meet.meter.auto")
            )}
          </span>
          {lastPatrolAt !== "" && (
            <>
              <span className="m-sep" aria-hidden="true" />
              <span>{t("meet.meter.auto")}</span>
            </>
          )}
          <span className="m-sep" aria-hidden="true" />
          <span>{t("meet.meter.keys")}</span>
        </div>
      </section>
      {/* 第6便構図: 主柱=届いた提案（読み物）／側柱=問いの手（sticky panel）.
          DOM order stays mobile's; the grid places columns. Layout only. */}
      <div className="m-home">
        <div className="m-home-left">
      <section className="m-section">
        <p className="m-eyebrow">{MEET.home.place.eyebrowAsk}</p>
        <div className="m-secrow">
          <h2 className="m-h2">{MEET.home.place.confirmHeading}</h2>
        </div>
        <textarea
          className="m-field"
          rows={2}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onBlur={() => void memory.setQuestion(question)}
          placeholder={MEET.home.question.placeholder}
        />
        <p className="m-note">
          {MEET.home.question.twoTenses} {MEET.home.question.note}
        </p>

        <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}>
          {ready && (
            <button
              type="button"
              className="m-btn m-btn-primary"
              style={{ flex: 1 }}
              onClick={() => void receive()}
              disabled={gen.phase === "busy"}
            >
              {gen.phase === "busy" ? MEET.receive.busy : MEET.home.receive}
            </button>
          )}
          <button
            type="button"
            className="m-btn m-btn-quiet"
            style={ready ? undefined : { flex: 1 }}
            onClick={openPlace}
            disabled={question.trim() === "" || placeDraft !== null}
          >
            {MEET.home.place.action}
          </button>
        </div>
        {!ready && (
          <div className="m-empty" style={{ marginTop: "0.75rem", textAlign: "left" }}>
            {/* c12-4: each row carries its own 導線 — the key/memory rows land
                on their はじめかた step, the name row lands on the 記憶 name
                field (it lives there, not on はじめかた). */}
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
                  {MEET.receive.needName}{" "}
                  <Link className="m-rowlink" href="/meet/memory/#name">
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

      <SignalsSection
        inbox={inbox}
        firstNotes={firstNotes}
        onTalkBack={talkBack}
        onSaveContact={saveContact}
        onMakeFirstNote={makeFirstNote}
        onSaveFirstNote={saveFirstNote}
      />
        </div>

        <div className="m-home-right">
      <section className="m-section">
        <p className="m-eyebrow">{MEET.home.proposals.eyebrow}</p>
        <div className="m-secrow">
          <h2 className="m-h2">{MEET.home.proposals.heading}</h2>
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
                  sentRefs={sentRefs}
                  onTalk={talk}
                  onReading={reading}
                  onRemove={removeEntry}
                />
              ))}
            </ul>
          </>
        )}
      </section>

      <BoundaryNote
        lines={[MEET.boundary.memory, MEET.boundary.ai, MEET.boundary.order, MEET.boundary.disclosure]}
      />
        </div>
      </div>
    </>
  );
}
