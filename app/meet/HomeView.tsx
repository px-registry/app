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

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { MEET } from "@/lib/meet/copy.ts";
import {
  openMeetMemory,
  openReceived,
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
  type InboxData,
} from "@/lib/meet-net";
import {
  getModel,
  getKey,
  getEndpoint,
  isConnected,
  buildMeetPrompt,
  toRigPool,
  parseProposalReply,
  generateProposals,
} from "@/lib/meet-ai";
import { pastedOutputEchoesPrivate, type RigOwnerV1 } from "@/lib/rig";
import { ProposalEntry } from "./ProposalEntry.tsx";
import { SignalsSection } from "./SignalsSection.tsx";
import { BoundaryNote } from "./BoundaryNote.tsx";

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

export function HomeView() {
  const memory = useMemo(() => openMeetMemory(), []);
  const shelf = useMemo(() => openReceived(), []);

  const [question, setQuestion] = useState("");
  const [rigEntries, setRigEntries] = useState<RigEntry[]>([]);
  const [displayName, setDisplayName] = useState("");
  const [connected, setConnected] = useState(false);
  const [received, setReceived] = useState<ReceivedProposalV1[]>([]);
  const [inbox, setInbox] = useState<InboxData | null>(null);
  const [gen, setGen] = useState<GenState>({ phase: "idle" });
  const [placeDraft, setPlaceDraft] = useState<PlaceDraft | null>(null);
  const [editingPlaced, setEditingPlaced] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState("");
  const [poolBusy, setPoolBusy] = useState(false);

  const reload = useCallback(async () => {
    setQuestion(await memory.getQuestion());
    setRigEntries(await memory.listRigItems());
    const profile = await memory.getProfile();
    setDisplayName(profile?.displayName.trim() ?? "");
    setConnected(isConnected());
    setSnapshot(getPublishedSnapshot());
    const list = await shelf.list();
    list.reverse(); // newest first — arrival time, nothing else
    setReceived(list);
    const ib = await fetchInbox(getOrMintOwnerToken());
    setInbox(ib.ok ? ib : null);
  }, [memory, shelf]);

  useEffect(() => {
    void reload();
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
    // The question moved onto the waiting list — leaving it in the いま聞く box
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
      items,
    });
    if (r.ok) {
      const json = projectionSnapshotJson(items);
      setPublishedSnapshot(json);
      setSnapshot(json);
    }
    setPoolBusy(false);
  };

  const receive = async () => {
    setGen({ phase: "busy" });
    await memory.setQuestion(question);
    const items = (await memory.listRigItems()).map((e) => e.item);
    const self: RigOwnerV1 = { ownerId: "self", items };

    const me = await deriveParticipantRef(getOrMintOwnerToken());
    const poolRes = await fetchPool(me);
    if (!poolRes.ok) {
      setGen({ phase: "error", code: "pool" });
      return;
    }
    const refs: Record<string, string> = {};
    for (const it of poolRes.items) {
      if (!(it.ownerRef in refs)) refs[it.ownerRef] = it.participantRef;
    }

    const prompt = buildMeetPrompt(self, toRigPool(poolRes.items), question);
    const model = getModel();
    const r = await generateProposals({
      model,
      apiKey: model.provider === "ollama" ? "" : getKey(model.provider),
      endpoint: getEndpoint(),
      prompt,
    });
    if (!r.ok) {
      setGen({ phase: "error", code: r.error });
      return;
    }
    const entry = await shelf.add({
      question: question.trim(),
      modelLabel: model.label,
      raw: r.text,
      cards: parseProposalReply(r.text),
      refs,
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
    setGen({ phase: "idle" });
    await reload();
  };

  const talk = async (toRef: string, anchor: string) => {
    await sendSignal({ ownerToken: getOrMintOwnerToken(), toRef, fromName: displayName, anchor });
    await reload();
  };

  const talkBack = async (toRef: string) => {
    await sendSignal({ ownerToken: getOrMintOwnerToken(), toRef, fromName: displayName, anchor: "" });
    await reload();
  };

  const saveContact = async (peerRef: string, note: string): Promise<boolean> => {
    const r = await saveContactNote({ ownerToken: getOrMintOwnerToken(), peerRef, note });
    if (r.ok) await reload();
    return r.ok;
  };

  const reading = async (entryId: string, cardIndex: number, value: ReadingV1) => {
    await shelf.setReading(entryId, cardIndex, value);
    const list = await shelf.list();
    const entry = list.find((e) => e.entryId === entryId);
    if (entry) {
      void submitLog({
        ownerToken: getOrMintOwnerToken(),
        clientEntryId: entry.entryId,
        displayName,
        question: entry.question,
        proposalText: entry.raw,
        reading: readingJson(entry),
      });
    }
    list.reverse();
    setReceived(list);
  };

  const removeEntry = async (entryId: string) => {
    await shelf.remove(entryId);
    await reload();
  };

  return (
    <>
      <section className="m-section">
        <h1 className="m-h1">{MEET.home.question.heading}</h1>
        <p className="m-lede" style={{ fontSize: "0.95rem" }}>
          {MEET.lede}
        </p>
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
            <ul style={{ margin: 0, paddingLeft: "1.2em" }}>
              {!connected && <li>{MEET.receive.needKey}</li>}
              {!hasItems && <li>{MEET.receive.needMemory}</li>}
              {displayName === "" && <li>{MEET.receive.needName}</li>}
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
        {gen.phase === "error" && (
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
          <h2 className="m-h2">{MEET.home.place.listHeading}</h2>
          <ul className="m-itemlist">
            {placedEntries.map((e) => (
              <li key={e.entryId} className="m-item">
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
                      {placedState(e.item)}
                    </p>
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

      <SignalsSection inbox={inbox} onTalkBack={talkBack} onSaveContact={saveContact} />

      <section className="m-section">
        <h2 className="m-h2">{MEET.home.proposals.heading}</h2>
        {received.length === 0 ? (
          <div className="m-empty">{MEET.home.proposals.empty}</div>
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
    </>
  );
}
