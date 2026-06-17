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
import { MEET, questionPlaceholderByHour } from "@/lib/meet/copy.ts";
import {
  openMeetMemory,
  openMemJournal,
  openReceived,
  openFirstNotes,
  openItemAliases,
  openEncKeys,
  openTalk,
  openPeerKeys,
  PLACED_QUESTION_TAG,
  draftPlacedQuestionTitle,
  isPlacedQuestion,
  toPublicView,
  adoptPortItems,
  type MeetRigItemV1,
  type ReceivedProposalV1,
  type ReadingV1,
  type TalkEntryV1,
} from "@/lib/meet-memory";
import {
  getOrMintOwnerToken,
  deriveParticipantRef,
  mintEdgeId,
  mintEnvelopeId,
  fetchPool,
  fetchInbox,
  fetchEncKey,
  sendSignal,
  sendTalkBack,
  sendClose,
  sendEnvelope,
  fetchEnvelopes,
  ackEnvelopes,
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
  buildDockSearchPrompt,
  toRigPoolWithRefs,
  parseProposalReply,
  generateProposals,
  renderMemoryContext,
  buildAntennaPrompt,
  parseAntennaCandidates,
  type AntennaCandidate,
  pickPatrolTarget,
  anchorForRecipient,
  buildFirstNotePrompt,
  parseFirstNoteReply,
  firstNoteMaterialFor,
  gateCardsByProvenance,
  buildNoteDraftPrompt,
  buildContactDraftPrompt,
  contactDraftKeepsPlaceholder,
  buildEpiloguePrompt,
  parsePublicPhrasingReply,
  type BasisMap,
} from "@/lib/meet-ai";
import { pastedOutputEchoesPrivate, type RigOwnerV1 } from "@/lib/rig";
import { mintEncKeyPair, encPubToString, parseEncPub } from "@/lib/meet-crypto/keys.ts";
import { sealEnvelope, openEnvelope } from "@/lib/meet-crypto/envelope.ts";
import { pollMesh } from "@/lib/meet-mesh/sync.ts";
import { mergeTalkTimeline } from "@/lib/meet-mesh/timeline.ts";
import { useT } from "@/lib/i18n/context.tsx";
import { SignalsSection, type FirstNoteFaceData } from "./SignalsSection.tsx";
import { BoundaryNote } from "./BoundaryNote.tsx";
import { fmtHm } from "./format.ts";
import { MeetWorkspace } from "./MeetWorkspace.tsx";
import { AntennaSurface } from "./surfaces/AntennaSurface.tsx";
import { ProposalsSurface } from "./surfaces/ProposalsSurface.tsx";
import {
  MeetWorkspaceProvider,
  type MeetWorkspaceValue,
  type SurfaceKey,
  type GenState,
  type RigEntry,
  type PlaceDraft,
} from "./MeetWorkspaceContext.tsx";

// 第9便 A: endings live as ENTRIES now; under the button only the running
// indicator and the last-resort line (entry write itself failed) remain.
// ワークスペース化(β) 第1便: 型（GenState/RigEntry/PlaceDraft）は ./MeetWorkspaceContext、
// fmtHm は ./format、PlacedEdit は ./surfaces/AntennaSurface へ持ち出した（見た目不変）。

function readingJson(entry: ReceivedProposalV1): string {
  return JSON.stringify({ echo: entry.echoFlag, cards: entry.readings });
}

export function HomeView() {
  const t = useT();
  const memory = useMemo(() => openMeetMemory(), []);
  // 記憶装置 §0.6 — アンテナ候補は journal（第1便の長さ）を読む（第2便 reading）。
  const journal = useMemo(() => openMemJournal(), []);
  const shelf = useMemo(() => openReceived(), []);
  // c17: 第一信の下書きレーン — edge 単位・端末のみ（serverへ送らない）
  const notesLane = useMemo(() => openFirstNotes(), []);
  // R2 0010: 端末側の item_ref alias 対応表（内部 entryId → 公開 alias）
  const aliasLane = useMemo(() => openItemAliases(), []);
  // R2 0013: E2EE 鍵対（秘密鍵はこの端末の IndexedDB だけ・公開鍵を publish に同送）
  const encLane = useMemo(() => openEncKeys(), []);
  // R2 便6: トークの棚（開封済み本文の唯一の置き場）＋ peer 鍵世代の覚え
  const talkLane = useMemo(() => openTalk(), []);
  const peerKeyLane = useMemo(() => openPeerKeys(), []);

  // ワークスペース化(β) — 器: canvas に開く面（rail で切替・C裁定一面）。
  const [activeSurface, setActiveSurface] = useState<SurfaceKey>("antenna");
  // 「あなたのAI」窓（floating）の開閉 — rail の窓トグルと FAB が同じ state を握る。
  const [windowOpen, setWindowOpen] = useState(false);
  const [question, setQuestion] = useState("");
  // Antenna 化の小便: placeholder が機能を語る（時間帯 v1・静的）。SSR/prerender と
  // の不一致を避けるため mount 後に時刻で確定する（空の一瞬は無害 — 値ではない）。
  const [qPlaceholder, setQPlaceholder] = useState("");
  useEffect(() => {
    setQPlaceholder(questionPlaceholderByHour(new Date().getHours()));
  }, []);
  // 探しにいく の結末行（AI 未接続のときに正直に倒す — 既存 offline 定数を再利用）
  const [seekNote, setSeekNote] = useState("");
  const [rigEntries, setRigEntries] = useState<RigEntry[]>([]);
  const [aliases, setAliases] = useState<Map<string, string>>(new Map());
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
  // 記憶装置 §0.6 — そっと置かれるアンテナ候補（一枚・通知ではない）。生成は一度だけ
  // 静かに走り、無視（×）すればこのセッションでは出さない（圧の装置を作らない）。
  const [candidate, setCandidate] = useState<AntennaCandidate | null>(null);
  const candidateRan = useRef(false);
  const [snapshot, setSnapshot] = useState("");
  const [poolBusy, setPoolBusy] = useState(false);
  const [patrolBusy, setPatrolBusy] = useState(false);
  const [lastPatrolAt, setLastPatrolAt] = useState("");
  // 第9便 C — 気配: a count, never a list (M-6 stays).
  const [participants, setParticipants] = useState<number | null>(null);
  // c18b — 受動マーキング: refs currently IN the pool, from the same fetch the
  // 気配 already does (no new read endpoint; null = couldn't tell → no marks).
  const [poolRefs, setPoolRefs] = useState<Set<string> | null>(null);
  // 便6 — edge ごとのトーク（開封済み・時刻順）と、相手の立てたノート（standing）
  const [threads, setThreads] = useState<Record<string, TalkEntryV1[]>>({});
  const [peerNotes, setPeerNotes] = useState<Record<string, string>>({});
  // R2 GOAL — チャットポートからの下書きリンク（/meet/?room=<edgeId>#draft=<text>）。
  // # 以降はブラウザがサーバに送らない — 平文非読は URL の構造が担う。one-shot:
  // 読んだら URL から消す（書かれた下書き自体はトーク欄が保全する）。
  const [portDraft, setPortDraft] = useState<{ edgeId: string; text: string } | null>(null);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const room = params.get("room") ?? "";
    const hash = window.location.hash;
    if (room === "" || !hash.startsWith("#draft=")) return;
    const rawText = hash.slice("#draft=".length);
    let text = "";
    try {
      text = decodeURIComponent(rawText);
    } catch {
      text = rawText; // 雑なエンコードでも下書きを失わない（fail-open は表示のみ）
    }
    if (text.trim() === "") return;
    setPortDraft({ edgeId: room, text });
    window.history.replaceState(null, "", window.location.pathname);
  }, []);
  // サブページ統一便 — rail の面の道具をサブページ（記憶・Setup）で押すと /meet/?s=<面>
  // で home に戻る。ここでその面を開き、URL を片づける（既存 ?room/#draft と同じ作法・
  // room が併存しないときだけ search を消す）。
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const s = params.get("s");
    if (s !== "antenna" && s !== "proposals" && s !== "talk") return;
    setActiveSurface(s);
    if (params.get("room") === null) {
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);
  // 下書きが来たら canvas をトーク面へ寄せる（room はトーク面にしか無い・一面）。
  useEffect(() => {
    if (portDraft === null || inbox === null) return;
    setActiveSurface("talk");
  }, [portDraft, inbox]);
  // トーク面が立ったら宛先ルームへ静かに寄る（motion なし・一度だけ）。
  useEffect(() => {
    if (portDraft === null || activeSurface !== "talk") return;
    document.getElementById(`room-${portDraft.edgeId}`)?.scrollIntoView({ block: "center" });
  }, [portDraft, activeSurface]);

  const reload = useCallback(async () => {
    setQuestion(await memory.getQuestion());
    const rig = await memory.listRigItems();
    setRigEntries(rig);
    // alias は読み込みついでに mint しておく（publish 時にも再取得して鮮度を担保）
    setAliases(await aliasLane.getOrMintAll(rig.map((e) => e.entryId)));
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
    // R2 GOAL — チャットポートの reverse-import: port（あなたのAI・owner 確認つき）
    // が additive に立てた公開行を、端末の記憶へ取り込み alias を結ぶ。以後は端末が
    // 正本を持ち、publish の atomic replace で消えない（0010 alias 継続）。
    if (ib.ok && ib.myItems.length > 0) {
      const adopted = await adoptPortItems(memory, aliasLane, ib.myItems);
      if (adopted > 0) {
        const rig2 = await memory.listRigItems();
        setRigEntries(rig2);
        setAliases(await aliasLane.getOrMintAll(rig2.map((e) => e.entryId)));
      }
    }
    // c17: face data per mutual pair — basis from the owner-local shelf (the
    // same provenance gate the display uses), draft from the firstnote lane.
    // 便4: 下書きは edge に閉じる（鮮度原則）— 顔データも edgeId キー。
    // 旧 R1.5 の相手単位下書きは notesLane.get の lazy 移行が一度だけ拾う。
    const fn: Record<string, FirstNoteFaceData> = {};
    if (ib.ok) {
      for (const sig of ib.incoming) {
        if (sig.state !== "mutual") continue;
        const m = firstNoteMaterialFor(sig.fromRef, list, sig.anchor);
        fn[sig.edgeId] = { basis: m.basis, draft: await notesLane.get(sig.edgeId, sig.fromRef) };
      }
      // 便3: a 側の pair 面（outgoing mutual）にも同じ顔データを用意する。
      for (const o of ib.outgoing) {
        if (o.state !== "mutual" || o.edgeId in fn) continue;
        const m = firstNoteMaterialFor(o.toRef, list, o.anchor);
        fn[o.edgeId] = { basis: m.basis, draft: await notesLane.get(o.edgeId, o.toRef) };
      }
    }
    setFirstNotes(fn);
    // ── 便6: 封筒の受け取り（pull・通知なし）→ 端末で開封 → トークの棚 → ack ──
    // ack は内部信号 — 相手の UI には何も生まれない（0013 条件2）。開封できない
    // 封筒（鍵違い等）は held のまま残し、TTL が不達として正直に処理する（fail-closed）。
    const myKeys = await encLane.getOrMint(mintEncKeyPair);
    const envRes = await fetchEnvelopes(getOrMintOwnerToken());
    if (envRes.ok) {
      const notes: Record<string, string> = {};
      const ackIds: string[] = [];
      for (const v of envRes.incoming) {
        const text = await openEnvelope(myKeys.priv, v);
        if (v.kind === "note") {
          // ノートは standing — ack しない（畳むのは author の上書きか縁の閉じ）
          if (text !== null) notes[v.edgeId] = text;
          continue;
        }
        if (text === null) continue;
        await talkLane.put({
          entryId: v.envelopeId,
          edgeId: v.edgeId,
          kind: v.kind === "contact" ? "contact-in" : "in",
          text,
          at: v.createdAt,
        });
        ackIds.push(v.envelopeId);
      }
      for (const x of envRes.expired) {
        // 不達の正直な一行 — スレッドの事実行として残してから tombstone を片づける
        await talkLane.put({ entryId: x.envelopeId, edgeId: x.edgeId, kind: "expired", text: "", at: x.createdAt });
        ackIds.push(x.envelopeId);
      }
      if (ackIds.length > 0) void ackEnvelopes(getOrMintOwnerToken(), ackIds);
      setPeerNotes(notes);
    }
    // Device Mesh dual-read: mesh の talk delta を**同じ棚**へ取り込んでから読む（身元無しは no-op・
    // best-effort）。legacy（envelope）と mesh（talk-msg/talk-mirror）が同一 talk store に入り、
    // entryId で dedup される。並び（時刻順）は棚の責務 — UI レーンは sort しない（M-4）。
    // mergeTalkTimeline で (at,entryId) 決定的順＋edge_note(note-out) を timeline から除外（§15）。
    await pollMesh().catch(() => undefined);
    const grouped = await talkLane.threadsByEdge();
    const mergedThreads: Record<string, TalkEntryV1[]> = {};
    for (const edgeId of Object.keys(grouped)) mergedThreads[edgeId] = mergeTalkTimeline(grouped[edgeId]);
    setThreads(mergedThreads);

    setLastPatrolAt(getPatrolLastRun());
    // 気配: how many participants are in the pool right now (count only)
    const me = await deriveParticipantRef(getOrMintOwnerToken());
    const poolNow = await fetchPool(me);
    const refsNow = poolNow.ok ? new Set(poolNow.items.map((it) => it.participantRef)) : null;
    setParticipants(refsNow === null ? null : refsNow.size);
    setPoolRefs(refsNow);
  }, [memory, shelf, notesLane, aliasLane, encLane, talkLane]);

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
  // R2 0010/便3: カード（接点）単位の edge 地図 — キーは `${toRef}:${basisItemRef}`。
  // live（sent/mutual）が常に勝つ。closed は「相手が sent 段階で止めた」場合だけ
  // 載せる（stopped の一語表示）。自分の取り下げは載せない（自分の行為 — カードは
  // 押せる状態に戻る）。mutual からの閉じは pair 面（合図欄）が語る。
  const cardEdges = useMemo(() => {
    const m = new Map<
      string,
      { edgeId: string; state: "sent" | "mutual" | "closed"; dormant: boolean }
    >();
    for (const o of inbox?.outgoing ?? []) {
      const key = `${o.toRef}:${o.basisItemRef}`;
      if (o.state !== "closed") {
        m.set(key, { edgeId: o.edgeId, state: o.state, dormant: o.dormant });
      } else if (!m.has(key) && !o.closedByMe && o.closedFrom === "sent") {
        m.set(key, { edgeId: o.edgeId, state: "closed", dormant: false });
      }
    }
    return m;
  }, [inbox]);
  // 便3: a 側の pair 面（mutual の前室と、トークが閉じられた事実）は outgoing で建つ。
  const outgoingPairs = useMemo(
    () =>
      (inbox?.outgoing ?? []).filter(
        (o) => o.state === "mutual" || (o.state === "closed" && o.closedFrom === "mutual"),
      ),
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
  const projRows = buildOutboundProjection(
    rigEntries.map((x) => ({
      itemRef: aliases.get(x.entryId) ?? "",
      view: toPublicView(x.item),
      business: x.item.business === true,
    })),
  );
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

  // 分解で AntennaSurface へ移した問い欄の onBlur 保存（memory は surface に露出
  // しないので、この一手だけ HomeView 側のハンドラ経由で context に渡す）。
  const persistQuestion = () => void memory.setQuestion(question);

  const openPlace = () => {
    const q = question.trim();
    if (q === "") return;
    setPlaceDraft({ title: draftPlacedQuestionTitle(q), text: q, private: false, business: false });
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
        // 0012: ビジネス旗 — 項目に付く事実（boolean 一枚・既定オフ）
        business: placeDraft.business,
      },
    });
    setPlaceDraft(null);
    // The question moved onto the waiting list — leaving it in the 問い box
    // would feed it twice (问い block AND want card) on the next generation.
    setQuestion("");
    await memory.setQuestion("");
    await reload();
  };

  // 記憶装置 §0.6 — アンテナ候補をそっと生成（journal を読む・一度だけ・通知でない）。
  // reading 非汚染（第2便 RD-1 継承）: journal には書き戻さない — 読むだけ。
  const genCandidate = useCallback(async () => {
    if (candidateRan.current || !connected) return;
    candidateRan.current = true; // 一度だけ静かに（圧の装置を作らない）
    try {
      const records = await journal.list();
      if (records.length === 0) return; // journal が空なら候補は出さない（そっと）
      const model = getModel();
      const r = await generateProposals({
        model,
        apiKey: model.provider === "ollama" ? "" : getKey(model.provider),
        endpoint: getEndpoint(),
        prompt: buildAntennaPrompt(renderMemoryContext(records, "")),
      });
      if (!r.ok) return; // そっと: 失敗は黙る（正直な空＝候補なし）
      const cands = parseAntennaCandidates(r.text);
      if (cands.length > 0) setCandidate(cands[0]); // 一枚だけ薄く置く
    } catch {
      /* そっと: 候補は best-effort・例外も黙る */
    }
  }, [connected, journal]);

  // 察するのは AI・立てるのは owner: ✅ は既存の place 二態へ載せる（owner 確認カードを
  // 必ず経る — 候補から直に書き込まない＝第3便 AG-1 の二態を踏襲）。
  const placeCandidate = (c: AntennaCandidate) => {
    setPlaceDraft({
      title: c.title !== "" ? c.title : draftPlacedQuestionTitle(c.text),
      text: c.text,
      private: false,
      business: false,
    });
    setCandidate(null);
  };
  const dismissCandidate = () => setCandidate(null); // 無視すれば消える

  // つながっていれば、開いた時にそっと候補を一度だけ用意する（通知ではない）。
  useEffect(() => {
    if (connected) void genCandidate();
  }, [connected, genCandidate]);

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
    // R2 0010: alias は publish 時に必ず mint 済みの最新を取り直す（state の
    // 読み遅れで "" を送らない — server は itemRef 必須・fail-closed）。
    const aliasMap = await aliasLane.getOrMintAll(rigEntries.map((e) => e.entryId));
    const items = buildOutboundProjection(
      rigEntries.map((e) => ({
        itemRef: aliasMap.get(e.entryId) ?? "",
        view: toPublicView(e.item),
        business: e.item.business === true,
      })),
    );
    const keys = await encLane.getOrMint(mintEncKeyPair);
    const r = await publishProjection({
      ownerToken: getOrMintOwnerToken(),
      displayName,
      intro,
      encPub: encPubToString(keys.pub),
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
  // R2 GOAL — Dock L2: プロンプト合成を一枚に（構成的正直の土台）。プレビューが
  // 見せる文字列と generate に渡る文字列が同じ GenBundle から出る — 見せたものが
  // 送られるものそのもの。receivedLines を渡すと検索版（届いた提案ブロック入り）。
  type GenBundle = {
    prompt: string;
    refs: Record<string, string>;
    intros: Record<string, string>;
    basis: BasisMap;
    self: RigOwnerV1;
  };
  const assembleGen = async (
    q: string,
    receivedLines?: string[],
  ): Promise<{ ok: true; bundle: GenBundle } | { ok: false; code: "pool" | "pool-empty" }> => {
    const items = (await memory.listRigItems()).map((e) => e.item);
    const self: RigOwnerV1 = { ownerId: "self", items };
    const me = await deriveParticipantRef(getOrMintOwnerToken());
    const poolRes = await fetchPool(me);
    if (!poolRes.ok) return { ok: false, code: "pool" };
    // 第3便 A: an empty pool means there is nobody to propose — don't run
    // the model at all (a weak model invents partners; rule 7 is backed).
    if (poolRes.items.length === 0) return { ok: false, code: "pool-empty" };
    const refs: Record<string, string> = {};
    const intros: Record<string, string> = {};
    for (const it of poolRes.items) {
      if (!(it.ownerRef in refs)) refs[it.ownerRef] = it.participantRef;
      if (!(it.ownerRef in intros)) intros[it.ownerRef] = it.ownerIntro;
    }
    // 第7便 C: stable [p◯] refs ride the prompt; the same map is captured on
    // the entry so the gate + 「相手の候補から」 can resolve basisItemId.
    const { pool, basis } = toRigPoolWithRefs(poolRes.items);
    const prompt =
      receivedLines !== undefined
        ? buildDockSearchPrompt(self, pool, q, receivedLines)
        : buildMeetPrompt(self, pool, q);
    return { ok: true, bundle: { prompt, refs, intros, basis, self } };
  };

  const runGeneration = async (
    q: string,
    via: "manual" | "patrol",
    patrolMeta?: { title: string },
    prebuilt?: GenBundle,
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
      let bundle = prebuilt;
      if (bundle === undefined) {
        const a = await assembleGen(q);
        if (!a.ok) {
          await shelf.add(
            a.code === "pool"
              ? { ...base, outcome: "error", errorCode: "pool" }
              : { ...base, outcome: "pool-empty" },
          );
          return;
        }
        bundle = a.bundle;
      }
      const { prompt, refs, intros, basis, self } = bundle;
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

  // ── R2 GOAL — Dock L2: あなたのAIに探してもらう（owner 向け検索）────────────────
  // 検索の問いは standing の問いと別系（保存しない）。bundle は SELF＋プール＋
  // 届いている提案（gate 通過カードの digest）。プレビューを開いたら、その同じ
  // bundle が generate に渡る（構成的正直 — pool が動いても見せたものを送る）。
  const [dockAsk, setDockAsk] = useState("");
  const [dockBusy, setDockBusy] = useState(false);
  const [dockNote, setDockNote] = useState("");
  const [dockPreview, setDockPreview] = useState<{ ask: string; bundle: GenBundle } | null>(null);

  const receivedDigest = (): string[] => {
    const lines: string[] = [];
    for (const entry of received) {
      const { kept } = gateCardsByProvenance(entry.cards, entry.refs, entry.basisItems);
      for (const { card } of kept) {
        lines.push(`${card.to}: ${card.line1}`);
        if (lines.length >= 8) return lines;
      }
    }
    return lines;
  };

  const dockBuildPreview = async () => {
    const ask = dockAsk.trim();
    if (ask === "" || (dockPreview !== null && dockPreview.ask === ask)) return;
    const a = await assembleGen(ask, receivedDigest());
    if (a.ok) setDockPreview({ ask, bundle: a.bundle });
    else setDockNote(a.code === "pool" ? MEET.receive.errors.pool : MEET.home.dockSearch.poolEmpty);
  };

  const dockRun = async () => {
    const ask = dockAsk.trim();
    if (ask === "" || dockBusy) return;
    setDockBusy(true);
    setDockNote("");
    try {
      // プレビュー済みなら、その bundle そのもの（見せたもの＝送るもの）
      const bundle =
        dockPreview !== null && dockPreview.ask === ask ? dockPreview.bundle : undefined;
      if (bundle !== undefined) {
        await runGeneration(ask, "manual", undefined, bundle);
      } else {
        const a = await assembleGen(ask, receivedDigest());
        if (a.ok) await runGeneration(ask, "manual", undefined, a.bundle);
        else await runGeneration(ask, "manual"); // 正直なエラー entry は本線が書く
      }
      setDockNote(MEET.home.dockSearch.lands);
      setDockAsk("");
      setDockPreview(null);
    } catch {
      setDockNote(MEET.firstNote.failed);
    }
    setDockBusy(false);
    await reload();
  };

  // ── R2 GOAL — Dock L3: 操作の下書き（ノート・渡す文面 — 実行は既存確認動線）──
  // 材料は画面に見えているものだけ（SELF 記憶は同梱しない — private が乗らない
  // ので、プレビューは画面そのものが担う。drafts.ts の階級コメント参照）。
  const draftNote = async (edgeId: string, peerRef: string): Promise<string | null> => {
    const anchor =
      inbox?.incoming.find((s) => s.edgeId === edgeId)?.anchor ??
      inbox?.outgoing.find((o) => o.edgeId === edgeId)?.anchor ??
      "";
    const m = firstNoteMaterialFor(peerRef, received, anchor);
    const model = getModel();
    const r = await generateProposals({
      model,
      apiKey: model.provider === "ollama" ? "" : getKey(model.provider),
      endpoint: getEndpoint(),
      prompt: buildNoteDraftPrompt({ lines: m.lines, basis: m.basis, ownerName: displayName }),
    });
    if (!r.ok) return null;
    return parseFirstNoteReply(r.text);
  };

  // ── R2 GOAL — 後日談ループ（spec §11-6 前倒し・owner-local 完結）──────────────
  // 蒸留は任意（L0 = そのまま足す）。還流先は端末の記憶だけ — サーバ無関与。
  const distillEpilogue = async (
    words: string,
    peerName: string,
    anchor: string,
  ): Promise<{ title: string; text: string } | null> => {
    const model = getModel();
    const r = await generateProposals({
      model,
      apiKey: model.provider === "ollama" ? "" : getKey(model.provider),
      endpoint: getEndpoint(),
      prompt: buildEpiloguePrompt({ words, peerName, anchor }),
    });
    if (!r.ok) return null;
    return parsePublicPhrasingReply(r.text);
  };

  const addEpilogueMemory = async (title: string, text: string): Promise<boolean> => {
    try {
      await memory.create({
        kind: "rig_item",
        // AI が整えた形でも、足す行為は owner の確認（このボタン）— validator の階級どおり
        provenance: "owner_imported_confirmed",
        value: { kind: "memory", title, text, tags: [], private: true },
      });
    } catch {
      return false;
    }
    await reload();
    return true;
  };

  const draftContact = async (peerName: string): Promise<string | null> => {
    const model = getModel();
    const r = await generateProposals({
      model,
      apiKey: model.provider === "ollama" ? "" : getKey(model.provider),
      endpoint: getEndpoint(),
      prompt: buildContactDraftPrompt({ peerName, ownerName: displayName }),
    });
    if (!r.ok) return null;
    const text = parseFirstNoteReply(r.text);
    // fail-closed: 差し込み印の無い文面は採らない（発明された宛先を疑う）
    if (text === null || !contactDraftKeepsPlaceholder(text)) return null;
    return text;
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
  // R2 0010 T1: 話してみる は接点（edge）を開く。edge_id は端末 mint、根拠は
  // カードの basis item alias、proposalPtr は自分の棚への不透明ポインタのみ。
  // live-triple に既存があればサーバが既存 edge を正直に返す（押すことは一度
  // 押したこと — sent 表示はサーバ真実のまま）。
  const talk = async (
    toRef: string,
    basisItemRef: string,
    proposalPtr: string,
    line1: string,
    line2: string,
    to: string,
  ): Promise<{ ok: boolean; code: string }> => {
    const anchor = anchorForRecipient(line1, line2, to, displayName);
    const r = await sendSignal({
      ownerToken: getOrMintOwnerToken(),
      toRef,
      fromName: displayName,
      toName: to,
      anchor,
      edgeId: mintEdgeId(),
      basisItemRef,
      proposalPtr,
    });
    await reload();
    return r.ok ? { ok: true, code: "" } : { ok: false, code: r.error };
  };

  // R2 0010 T2: こちらも話してみる は届いた edge への返答 — 逆向きの新 edge を
  // 立てない（mutual は同じ接点で揃う）。
  const talkBack = async (edgeId: string): Promise<{ ok: boolean; code: string }> => {
    const r = await sendTalkBack({ ownerToken: getOrMintOwnerToken(), edgeId });
    await reload();
    return r.ok ? { ok: true, code: "" } : { ok: false, code: r.error };
  };

  // 便3 T3/T4/T5: 取り下げる／閉じる — participant の行為だけが遷移を書く。
  const closeEdge = async (edgeId: string): Promise<{ ok: boolean; code: string }> => {
    const r = await sendClose({ ownerToken: getOrMintOwnerToken(), edgeId });
    await reload();
    return r.ok ? { ok: true, code: "" } : { ok: false, code: r.error };
  };

  // ── 便6: トーク — 端末で施錠して投函・自分の転写は端末の棚へ ────────────────────
  // 鍵世代が変わっていたら「相手の鍵が変わりました。」の事実行をスレッドへ（判定なし）。
  const sealAndSend = async (
    edgeId: string,
    peerRef: string,
    kind: "message" | "contact" | "note",
    text: string,
  ): Promise<{ ok: boolean; code: string }> => {
    const k = await fetchEncKey(peerRef);
    if (!k.ok) return { ok: false, code: k.error };
    const pub = parseEncPub(k.encPub);
    if (pub === null) return { ok: false, code: "enckey_failed" };
    const prevGen = await peerKeyLane.get(peerRef);
    if (prevGen !== null && k.gen > prevGen) {
      await talkLane.put({
        entryId: `tkey_${peerRef}_${k.gen}`,
        edgeId,
        kind: "keychange",
        text: "",
        at: new Date().toISOString(),
      });
    }
    await peerKeyLane.set(peerRef, k.gen);
    const sealed = await sealEnvelope(pub, text);
    const envelopeId = mintEnvelopeId();
    const r = await sendEnvelope({ ownerToken: getOrMintOwnerToken(), envelopeId, edgeId, kind, ...sealed });
    if (!r.ok) return { ok: false, code: r.error };
    if (kind === "note") {
      // standing の端末転写 — 固定キーで最新だけが立つ（スレッドには並べない）
      await talkLane.replace({
        entryId: `tnote_${edgeId}`,
        edgeId,
        kind: "note-out",
        text,
        at: new Date().toISOString(),
      });
    } else {
      await talkLane.put({
        entryId: envelopeId,
        edgeId,
        kind: kind === "contact" ? "contact-out" : "out",
        text,
        at: new Date().toISOString(),
      });
    }
    await reload();
    return { ok: true, code: "" };
  };

  const sendTalkMessage = (edgeId: string, peerRef: string, text: string) =>
    sealAndSend(edgeId, peerRef, "message", text);

  // ── Wave 2: Dock Lite — あなたのAIに聞く（browser直・owner の鍵・PX no-log）。
  // submitLog（テスト開示レーン）はこの経路に存在しない — 返事はどこにも残らない
  // （draft only・表示だけ）。
  const askYourAi = async (prompt: string): Promise<{ ok: boolean; text: string; code: string }> => {
    const model = getModel();
    const r = await generateProposals({
      model,
      apiKey: model.provider === "ollama" ? "" : getKey(model.provider),
      endpoint: getEndpoint(),
      prompt,
    });
    return r.ok ? { ok: true, text: r.text, code: "" } : { ok: false, text: "", code: r.error };
  };
  // 便6: ノートを立てる・直す（standing — 一人一枚・編集は再封）
  const saveNote = async (edgeId: string, peerRef: string, text: string): Promise<{ ok: boolean; code: string }> =>
    sealAndSend(edgeId, peerRef, "note", text);

  // 便6-3: 渡す（contact）は E2EE 封筒へ — 平文レーン（saveContactNote）は新規の
  // 書込に使わない（既存平文の読みはカットオーバーの二重読み窓まで残る）。
  const saveContact = async (edgeId: string, peerRef: string, note: string): Promise<boolean> => {
    const r = await sealAndSend(edgeId, peerRef, "contact", note);
    return r.ok;
  };

  // ── c17: 第一信 — owner の鍵・owner の端末でだけ生成し、端末にだけ残す ────────
  // The send is copy → outside channel; nothing here calls lib/meet-net.
  // 便4: 保存キーは edgeId（鮮度原則 — 同じ相手との別の接点は別の下書き）。
  const makeFirstNote = async (edgeId: string, peerRef: string): Promise<string | null> => {
    const anchor =
      inbox?.incoming.find((s) => s.edgeId === edgeId)?.anchor ??
      inbox?.outgoing.find((o) => o.edgeId === edgeId)?.anchor ??
      "";
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
    await notesLane.save(edgeId, text); // reload しても下書きが残る
    setFirstNotes((prev) => ({ ...prev, [edgeId]: { basis: m.basis, draft: text } }));
    return text;
  };

  const saveFirstNote = async (edgeId: string, text: string): Promise<void> => {
    await notesLane.save(edgeId, text);
    setFirstNotes((prev) => ({
      ...prev,
      [edgeId]: { basis: prev[edgeId]?.basis ?? null, draft: text },
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

  // ワークスペース化(β) 第1便 — 分解の受け皿（E裁定: context lite）。state・action は
  // すべて HomeView が今までどおり持ち、その値を surface へ配るだけ（見た目不変）。
  const ws: MeetWorkspaceValue = {
    activeSurface,
    setActiveSurface,
    windowOpen,
    setWindowOpen,
    connected,
    ready,
    hasItems,
    displayName,
    participants,
    question,
    setQuestion,
    persistQuestion,
    qPlaceholder,
    seekNote,
    setSeekNote,
    gen,
    receive,
    openPlace,
    placeDraft,
    setPlaceDraft,
    confirmPlace,
    candidate,
    placeCandidate,
    dismissCandidate,
    placedEntries,
    placedState,
    readsOf,
    snapshot,
    editingPlaced,
    setEditingPlaced,
    savePlaced,
    setPlacedPrivate,
    removePlaced,
    poolStale,
    updatePool,
    poolBusy,
    rigEntries,
    received,
    cardEdges,
    poolRefs,
    lastPatrolAt,
    dockAsk,
    setDockAsk,
    dockNote,
    setDockNote,
    dockBusy,
    dockPreview,
    dockBuildPreview,
    dockRun,
    talk,
    closeEdge,
    askYourAi,
    reading,
    removeEntry,
  };

  return (
    <MeetWorkspaceProvider value={ws}>
      {/* 墨工房 文言実験 第1手（Hiroto 裁定 2026-06-16）: 計器の帯を canvas 最上部から
          退かす（工房では計器は常時主張せず静かに添える）。帯は home の状態（見回り・接続）
          を映すので home が描き続ける——フッター際の薄い一行へ格下げ（下部 m-meterstrip）。
          緑ドットと「鍵はこの端末の中」は保持・位置だけ静かに（所有の約束は消さない）。 */}
      {/* 器（rail＋canvas 主役）: rail で面を選ぶと canvas に大きく開く（C裁定一面）。
          二柱対等（旧 .m-home）を canvas 主役＋rail 脇役へ役割転換。 */}
      <MeetWorkspace>
        {activeSurface === "antenna" && <AntennaSurface />}
        {activeSurface === "proposals" && <ProposalsSurface />}
        {activeSurface === "talk" && (
          <>
            {/* R2 GOAL — 沈黙の禁止: 下書きリンクの宛先が見つからないとき、その事実を言う */}
            {portDraft !== null &&
              inbox !== null &&
              ![...inbox.incoming, ...inbox.outgoing].some(
                (e) => e.edgeId === portDraft.edgeId && e.state === "mutual",
              ) && (
                <p className="m-note" aria-live="polite">
                  {MEET.home.talk.portDraftMiss}
                </p>
              )}
            <SignalsSection
              inbox={inbox}
              outgoingPairs={outgoingPairs}
              firstNotes={firstNotes}
              threads={threads}
              peerNotes={peerNotes}
              poolRefs={poolRefs}
              portDraft={portDraft}
              onTalkBack={talkBack}
              onClose={closeEdge}
              onSendMessage={sendTalkMessage}
              onSaveNote={saveNote}
              onSaveContact={saveContact}
              onMakeFirstNote={makeFirstNote}
              onSaveFirstNote={saveFirstNote}
              onDraftNote={draftNote}
              onDraftContact={draftContact}
              onDistillEpilogue={distillEpilogue}
              onAddMemory={addEpilogueMemory}
            />
          </>
        )}
      </MeetWorkspace>
      {/* 境界の開示は常時可視（憲法・どの面からも読める）。 */}
      {/* 表層語彙統一便 第2手: 記憶/預からない → 持つもの → 非ranking → あなたのAI → テスト開示。 */}
      <BoundaryNote
        lines={[
          MEET.boundary.memory,
          MEET.boundary.holds,
          MEET.boundary.order,
          MEET.boundary.ai,
          MEET.boundary.disclosure,
        ]}
      />
      {/* 計器の帯（格下げ後）— フッター際の薄い一行。緑ドット＝自動見回りの稼働印・
          「鍵はこの端末の中」＝所有の約束。静かに添えるだけ（説教にしない）。 */}
      <div className="m-meterstrip">
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
      </div>
      {/* あなたのAI FAB は器（MeetWorkspace）が描く — home/記憶/Setup 共通の司令塔。 */}
    </MeetWorkspaceProvider>
  );
}
