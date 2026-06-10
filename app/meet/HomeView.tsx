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

function readingJson(entry: ReceivedProposalV1): string {
  return JSON.stringify({ echo: entry.echoFlag, cards: entry.readings });
}

export function HomeView() {
  const memory = useMemo(() => openMeetMemory(), []);
  const shelf = useMemo(() => openReceived(), []);

  const [question, setQuestion] = useState("");
  const [hasItems, setHasItems] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [connected, setConnected] = useState(false);
  const [received, setReceived] = useState<ReceivedProposalV1[]>([]);
  const [inbox, setInbox] = useState<InboxData | null>(null);
  const [gen, setGen] = useState<GenState>({ phase: "idle" });

  const reload = useCallback(async () => {
    setQuestion(await memory.getQuestion());
    setHasItems((await memory.listRigItems()).length > 0);
    const profile = await memory.getProfile();
    setDisplayName(profile?.displayName.trim() ?? "");
    setConnected(isConnected());
    const list = await shelf.list();
    list.reverse(); // newest first — arrival time, nothing else
    setReceived(list);
    const ib = await fetchInbox(getOrMintOwnerToken());
    setInbox(ib.ok ? ib : null);
  }, [memory, shelf]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const ready = connected && hasItems && displayName !== "";
  const sentRefs = useMemo(
    () => new Set((inbox?.outgoing ?? []).map((o) => o.toRef)),
    [inbox],
  );

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
        <p className="m-note">{MEET.home.question.note}</p>

        {ready ? (
          <button
            type="button"
            className="m-btn m-btn-primary m-btn-wide"
            style={{ marginTop: "0.75rem" }}
            onClick={() => void receive()}
            disabled={gen.phase === "busy"}
          >
            {gen.phase === "busy" ? MEET.receive.busy : MEET.home.receive}
          </button>
        ) : (
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
      </section>

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
