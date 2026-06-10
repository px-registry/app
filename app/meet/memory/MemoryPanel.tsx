"use client";

// R1.5 あなたの記憶 — owner-local manager (Stage B MemoryManager lineage).
// Read / edit / export / import / delete all run on this device; the boundary
// block at the bottom states only what is true in code.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MEET } from "@/lib/meet/copy.ts";
import {
  openMeetMemory,
  toPublicView,
  hasPublicVariant,
  parseMaskWords,
  findMaskLeaks,
  filterDetections,
  applyMasks,
  mergeMaskWords,
  normalizeMaskText,
  type MaskPair,
  type MeetMemoryEntryV1,
  type MeetRigItemV1,
} from "@/lib/meet-memory";
import {
  getModel,
  getKey,
  getEndpoint,
  isConnected,
  generateProposals,
  buildDetectPrompt,
  parseDetectReply,
  buildIntroPrompt,
  parseIntroReply,
} from "@/lib/meet-ai";
import {
  getOrMintOwnerToken,
  buildOutboundProjection,
  publishProjection,
  getPublishedSnapshot,
  setPublishedSnapshot,
  projectionSnapshotJson,
  snapshotPendingCount,
} from "@/lib/meet-net";
import { RIG_MEMORY_KINDS, type RigMemoryKindV1 } from "@/lib/rig";
import { BoundaryNote } from "../BoundaryNote.tsx";

type RigEntry = { entryId: string; item: MeetRigItemV1 };

const BLANK: MeetRigItemV1 = { kind: "have", title: "", text: "", tags: [], private: true };

function toRigEntries(all: MeetMemoryEntryV1[]): RigEntry[] {
  const out: RigEntry[] = [];
  for (const e of all) if (e.kind === "rig_item") out.push({ entryId: e.entryId, item: e.value });
  return out;
}

/** What would actually leave — title and text in one honest line. */
function publicFace(item: MeetRigItemV1): string {
  const v = toPublicView(item);
  return v.title.trim() !== "" ? `${v.title} — ${v.text}` : v.text;
}

type DetectState =
  | { phase: "idle" }
  | { phase: "busy" }
  | { phase: "offered"; pairs: MaskPair[] }
  | { phase: "failed" }
  | { phase: "done" }; // applied or このまま出す — quiet until the text changes

type PickRow = { word: string; mask: string; use: boolean };

function ItemForm({
  initial,
  maskWords,
  onUpdateMaskWords,
  onSave,
  onCancel,
}: {
  initial: MeetRigItemV1;
  /** The byproduct list (これまでに伏せた言葉) — the deterministic check's vocabulary. */
  maskWords: string[];
  onUpdateMaskWords: (words: string[]) => Promise<void>;
  onSave: (item: MeetRigItemV1) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<MeetRigItemV1>(initial);
  const [tagsText, setTagsText] = useState(initial.tags.join("、"));
  const [connected] = useState(() => isConnected());
  const [detect, setDetect] = useState<DetectState>({ phase: "idle" });
  const [pick, setPick] = useState<PickRow[] | null>(null);
  const [histEdit, setHistEdit] = useState(false);
  const [histInput, setHistInput] = useState("");
  const lastDetectKey = useRef("");

  // 第4便 B — the inversion: on 「出す」 or opening 書き方, the owner's OWN AI
  // reads the OUTGOING text and OFFERS detections; the owner taps to decide.
  // Every offer passes the deterministic presence filter (no hallucinated
  // word survives), and a junk reply quietly offers nothing (fail-closed).
  const runDetect = async (item: MeetRigItemV1) => {
    if (!connected) return;
    const v = toPublicView(item);
    const key = `${v.title}\n${v.text}`;
    if (v.text.trim() === "" || detect.phase === "busy") return;
    // Same text + an open offer → don't re-ask. A quiet/failed round may be
    // retried by re-opening (the owner's explicit gesture).
    if (key === lastDetectKey.current && detect.phase === "offered") return;
    lastDetectKey.current = key;
    setDetect({ phase: "busy" });
    const model = getModel();
    const r = await generateProposals({
      model,
      apiKey: model.provider === "ollama" ? "" : getKey(model.provider),
      endpoint: getEndpoint(),
      prompt: buildDetectPrompt(v.title, v.text),
    });
    if (!r.ok) {
      setDetect({ phase: "failed" });
      return;
    }
    const pairs = filterDetections(parseDetectReply(r.text), v.title, v.text);
    setDetect(pairs.length > 0 ? { phase: "offered", pairs } : { phase: "done" });
  };

  // Tap-apply: rewrite the PUBLIC view only (the private body never changes)
  // and grow the byproduct list — from now on these words are checked
  // deterministically on every item.
  const applyPairs = (pairs: MaskPair[]) => {
    if (pairs.length > 0) {
      const v = toPublicView(draft);
      const r = applyMasks(v.title, v.text, pairs);
      setDraft((d) => ({ ...d, publicTitle: r.title, publicText: r.text }));
      void onUpdateMaskWords(mergeMaskWords(maskWords, pairs.map((p) => p.word)));
      lastDetectKey.current = "";
    }
    setDetect({ phase: "done" });
    setPick(null);
  };

  // [→ 伏せる] on the leak warning: that word only, mask from the AI's offer
  // when one exists, else the plain ●● default.
  const maskOne = (word: string) => {
    const offered = detect.phase === "offered" ? detect.pairs : [];
    const match = offered.find((p) => normalizeMaskText(p.word) === normalizeMaskText(word));
    const v = toPublicView(draft);
    const r = applyMasks(v.title, v.text, [{ word, mask: match?.mask ?? "" }]);
    setDraft((d) => ({ ...d, publicTitle: r.title, publicText: r.text }));
    lastDetectKey.current = "";
  };

  const view = toPublicView(draft);
  const leaks = draft.private ? [] : findMaskLeaks(maskWords, view.title, view.text);

  return (
    <div className="m-form">
      <div className="m-kindrow" role="group">
        {RIG_MEMORY_KINDS.map((k) => (
          <button
            key={k}
            type="button"
            className={`m-chip m-chip-pick ${draft.kind === k ? "m-chip-active" : ""}`}
            onClick={() => setDraft((d) => ({ ...d, kind: k as RigMemoryKindV1 }))}
          >
            {MEET.kinds[k]}
          </button>
        ))}
      </div>
      <label className="m-note">{MEET.memory.titleLabel}</label>
      <input
        className="m-field"
        value={draft.title}
        onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
      />
      <label className="m-note">{MEET.memory.textLabel}</label>
      <textarea
        className="m-field"
        rows={3}
        value={draft.text}
        onChange={(e) => setDraft((d) => ({ ...d, text: e.target.value }))}
      />
      <label className="m-note">{MEET.memory.tagsLabel}</label>
      <input className="m-field" value={tagsText} onChange={(e) => setTagsText(e.target.value)} />
      <details
        style={{ marginTop: "0.6rem" }}
        open={hasPublicVariant(draft)}
        onToggle={(e) => {
          if ((e.target as HTMLDetailsElement).open) void runDetect(draft);
        }}
      >
        <summary className="m-note" style={{ cursor: "pointer" }}>
          {MEET.publicWriting.summary}
        </summary>
        <p className="m-note" style={{ marginTop: "0.4rem" }}>
          {MEET.publicWriting.note}
        </p>
        <label className="m-note">{MEET.publicWriting.titleLabel}</label>
        <input
          className="m-field"
          value={draft.publicTitle ?? ""}
          onChange={(e) => setDraft((d) => ({ ...d, publicTitle: e.target.value }))}
        />
        <label className="m-note">{MEET.publicWriting.textLabel}</label>
        <textarea
          className="m-field"
          rows={2}
          value={draft.publicText ?? ""}
          onChange={(e) => setDraft((d) => ({ ...d, publicText: e.target.value }))}
        />
        {!connected && (
          <p className="m-note" style={{ marginTop: "0.4rem" }}>
            {MEET.maskWords.connectHint}
          </p>
        )}
        {maskWords.length > 0 && !histEdit && (
          <p className="m-note" style={{ marginTop: "0.5rem" }}>
            {MEET.maskWords.historyLine(maskWords.join(", "))}（
            <button
              type="button"
              className="m-link"
              onClick={() => {
                setHistInput(maskWords.join("、"));
                setHistEdit(true);
              }}
            >
              {MEET.maskWords.historyEdit}
            </button>
            ）
          </p>
        )}
        {histEdit && (
          <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.4rem" }}>
            <input
              className="m-field"
              value={histInput}
              onChange={(e) => setHistInput(e.target.value)}
            />
            <button
              type="button"
              className="m-btn m-btn-quiet"
              onClick={() => {
                void onUpdateMaskWords(parseMaskWords(histInput));
                setHistEdit(false);
              }}
            >
              {MEET.maskWords.historySave}
            </button>
          </div>
        )}
      </details>
      <div className="m-item-head" style={{ marginTop: "0.5rem" }}>
        <button
          type="button"
          className={`m-toggle ${draft.private ? "" : "m-toggle-on"}`}
          onClick={() => {
            const turningPublic = draft.private;
            setDraft((d) => ({ ...d, private: !d.private }));
            if (turningPublic) void runDetect({ ...draft, private: false });
          }}
          aria-pressed={!draft.private}
        >
          {draft.private ? MEET.intake.privateLabel : MEET.intake.publicLabel}
        </button>
      </div>

      {detect.phase === "busy" && <p className="m-note">{MEET.maskWords.detectBusy}</p>}
      {detect.phase === "failed" && (
        <p className="m-note" aria-live="polite" style={{ color: "var(--shu-deep)" }}>
          {MEET.maskWords.detectFailed}
        </p>
      )}
      {detect.phase === "offered" && pick === null && (
        <div className="m-card" style={{ marginTop: "0.5rem" }} aria-live="polite">
          <p className="m-note" style={{ margin: 0 }}>
            {MEET.maskWords.offerLead}
          </p>
          <p className="m-item-text" style={{ margin: "0.3rem 0" }}>
            {detect.pairs
              .map((p) => MEET.maskWords.offerPair(p.word, p.mask !== "" ? p.mask : "●●"))
              .join(" ／ ")}
          </p>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <button
              type="button"
              className="m-btn m-btn-primary"
              onClick={() => applyPairs(detect.pairs)}
            >
              {MEET.maskWords.maskAll}
            </button>
            <button
              type="button"
              className="m-btn m-btn-quiet"
              onClick={() => setPick(detect.pairs.map((p) => ({ ...p, use: true })))}
            >
              {MEET.maskWords.pickEach}
            </button>
            <button type="button" className="m-btn m-btn-quiet" onClick={() => applyPairs([])}>
              {MEET.maskWords.keepAsIs}
            </button>
          </div>
        </div>
      )}
      {pick !== null && (
        <div className="m-card" style={{ marginTop: "0.5rem" }}>
          <p className="m-note" style={{ margin: "0 0 0.4rem" }}>
            {MEET.maskWords.offerLead}
          </p>
          {pick.map((row, i) => (
            <div key={row.word} style={{ display: "flex", gap: "0.4rem", alignItems: "center", marginBottom: "0.35rem" }}>
              <button
                type="button"
                className={`m-chip m-chip-pick ${row.use ? "m-chip-active" : ""}`}
                aria-pressed={row.use}
                onClick={() =>
                  setPick((rows) =>
                    rows === null ? rows : rows.map((r, j) => (j === i ? { ...r, use: !r.use } : r)),
                  )
                }
              >
                {row.word}
              </button>
              <input
                className="m-field"
                value={row.mask}
                placeholder="●●"
                onChange={(e) =>
                  setPick((rows) =>
                    rows === null
                      ? rows
                      : rows.map((r, j) => (j === i ? { ...r, mask: e.target.value } : r)),
                  )
                }
              />
            </div>
          ))}
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              type="button"
              className="m-btn m-btn-primary"
              onClick={() => applyPairs(pick.filter((r) => r.use).map(({ word, mask }) => ({ word, mask })))}
            >
              {MEET.maskWords.applyPicked}
            </button>
            <button type="button" className="m-btn m-btn-quiet" onClick={() => applyPairs([])}>
              {MEET.maskWords.keepAsIs}
            </button>
          </div>
        </div>
      )}

      {!draft.private && draft.text.trim() !== "" && (
        // 顔 preview — which words would actually go out, said plainly.
        <p className="m-note" style={{ marginTop: "0.4rem" }}>
          {MEET.publicWriting.preview}
          {publicFace(draft)}
        </p>
      )}
      {leaks.length > 0 && (
        // Deterministic check on the OUTGOING text (byproduct-list vocabulary).
        // Warns while a word survives; [→ 伏せる] replaces that word only.
        // Never blocks — the owner may still send it out deliberately.
        <div aria-live="polite" style={{ marginTop: "0.4rem" }}>
          <p className="m-note" style={{ color: "var(--shu-deep)", margin: 0 }}>
            {MEET.maskWords.leakWarn(leaks.join("、"))}
          </p>
          <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
            {leaks.map((w) => (
              <button key={w} type="button" className="m-link" onClick={() => maskOne(w)}>
                {MEET.maskWords.maskOne(w)}
              </button>
            ))}
          </div>
        </div>
      )}
      <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}>
        <button
          type="button"
          className="m-btn m-btn-primary"
          disabled={draft.text.trim() === ""}
          onClick={() =>
            onSave({
              ...draft,
              tags: tagsText
                .split(/[、,]/)
                .map((t) => t.trim())
                .filter((t) => t.length > 0),
            })
          }
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

export function MemoryPanel() {
  const store = useMemo(() => openMeetMemory(), []);
  const [entries, setEntries] = useState<RigEntry[]>([]);
  const [displayName, setDisplayName] = useState("");
  const [intro, setIntroState] = useState("");
  const [introAi, setIntroAi] = useState<"idle" | "busy" | "failed">("idle");
  // effect-initialized — isConnected() touches localStorage (prerender-unsafe)
  const [panelConnected, setPanelConnected] = useState(false);
  const [savedName, setSavedName] = useState(false);
  const [editing, setEditing] = useState<string | null>(null); // entryId | "new"
  const [report, setReport] = useState("");
  const [maskWords, setMaskWords] = useState<string[]>([]);

  const reload = useCallback(async () => {
    setEntries(toRigEntries(await store.list()));
    setPanelConnected(isConnected());
    const profile = await store.getProfile();
    if (profile) {
      setDisplayName(profile.displayName);
      setIntroState(profile.intro ?? "");
    }
    // 第4便: the byproduct list (a pre-registered list, if any, just keeps
    // living in the same singleton — nothing is thrown away).
    setMaskWords(await store.getMaskWords());
  }, [store]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const saveName = async () => {
    // ひとこと紹介 publishes only via this explicit save + 候補に出す — an AI
    // draft that the owner didn't save never leaves the device.
    await store.setProfile({ displayName: displayName.trim(), intro: intro.trim() });
    setSavedName(true);
    setTimeout(() => setSavedName(false), 2000);
  };

  // 第7便 B: draft the intro from the owner's PUBLIC items only (差し出し型 —
  // fills the field; the owner edits, then 保存).
  const introDraft = async () => {
    setIntroAi("busy");
    const material = entries
      .filter((e) => e.item.private === false)
      .map((e) => toPublicView(e.item))
      .map((v) => ({ kind: v.kind, title: v.title, text: v.text }));
    const model = getModel();
    const r = await generateProposals({
      model,
      apiKey: model.provider === "ollama" ? "" : getKey(model.provider),
      endpoint: getEndpoint(),
      prompt: buildIntroPrompt(material),
    });
    const draft = r.ok ? parseIntroReply(r.text) : null;
    if (draft === null) {
      setIntroAi("failed");
      return;
    }
    setIntroState(draft);
    setIntroAi("idle");
  };

  /** The byproduct list grows from 伏せる taps (and shrinks via 編集). */
  const updateMaskWords = async (words: string[]) => {
    await store.setMaskWords(words);
    setMaskWords(words);
  };

  const saveItem = async (entryId: string | "new", item: MeetRigItemV1) => {
    if (entryId === "new") {
      await store.create({ kind: "rig_item", provenance: "owner_written", value: item });
    } else {
      await store.update(entryId, item);
    }
    setEditing(null);
    await reload();
  };

  const removeItem = async (entryId: string) => {
    await store.remove(entryId);
    await reload();
  };

  const togglePublic = async (e: RigEntry) => {
    await store.update(e.entryId, { ...e.item, private: !e.item.private });
    await reload();
  };

  const exportBackup = async () => {
    const dump = await store.exportAll();
    const blob = new Blob([JSON.stringify(dump, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "px-meet-memory.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const importBackup = async (file: File | undefined) => {
    if (!file) return;
    const r = await store.importBackup(await file.text());
    setReport(
      r.warnings.length > 0
        ? `${MEET.memory.importReport(r.added, r.updated)} ${r.warnings[0]}`
        : MEET.memory.importReport(r.added, r.updated),
    );
    await reload();
  };

  const clearAll = async () => {
    if (!window.confirm(MEET.memory.confirmClear)) return;
    await store.clear();
    setDisplayName("");
    await reload();
  };

  // ── publish (候補に出す) — explicit owner action, never automatic ────────────
  const [pubState, setPubState] = useState<"idle" | "busy" | "done" | "failed">("idle");
  const [pubCount, setPubCount] = useState(0);
  const [snapshot, setSnapshot] = useState("");
  const publicCount = entries.filter((e) => e.item.private === false).length;

  useEffect(() => {
    setSnapshot(getPublishedSnapshot());
  }, []);

  // 未反映 diff — what differs between the current projection and what was last
  // actually pushed from this device (symmetric difference, by item identity).
  // toPublicView first: what leaves is the 公開用の書き方 when one is set.
  const projection = buildOutboundProjection(entries.map((e) => toPublicView(e.item)));
  const pendingCount = snapshotPendingCount(snapshot, projection);

  const publish = async () => {
    setPubState("busy");
    // The outbound path runs through the frozen rig-core gate (fail-closed):
    // only private === false items can appear in the projection — and they
    // leave as their public view (候補に出すときの書き方 substituted).
    const items = buildOutboundProjection(entries.map((e) => toPublicView(e.item)));
    const r = await publishProjection({
      ownerToken: getOrMintOwnerToken(),
      displayName: displayName.trim(),
      intro: intro.trim(),
      items,
    });
    if (r.ok) {
      setPubCount(r.count);
      setPubState("done");
      const json = projectionSnapshotJson(items);
      setPublishedSnapshot(json);
      setSnapshot(json);
    } else {
      setPubState("failed");
    }
  };

  return (
    <>
      {/* 第6便構図: flat zones — DOM keeps the mobile order (名前→記憶→候補
          →整理→やくそく); the desktop grid places 主柱=記憶 / 側柱=残り.
          Layout only. */}
      <div className="m-mem">
      <section className="m-section m-mem-profile">
        <h2 className="m-h2">{MEET.profile.heading}</h2>
        <div className="m-card">
          <p className="m-note" style={{ margin: "0 0 0.5rem" }}>
            {MEET.profile.note}
          </p>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <input
              className="m-field"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={MEET.profile.placeholder}
            />
            <button type="button" className="m-btn m-btn-quiet" onClick={saveName}>
              {savedName ? MEET.profile.saved : MEET.profile.save}
            </button>
          </div>
          <label className="m-note" style={{ display: "block", marginTop: "0.6rem" }}>
            {MEET.profile.introLabel}
          </label>
          <p className="m-note" style={{ margin: "0 0 0.3rem" }}>
            {MEET.profile.introNote}
          </p>
          <input
            className="m-field"
            value={intro}
            onChange={(e) => setIntroState(e.target.value)}
            placeholder={MEET.profile.introPlaceholder}
            maxLength={80}
          />
          {panelConnected && (
            <button
              type="button"
              className="m-btn m-btn-quiet"
              style={{ marginTop: "0.4rem" }}
              disabled={introAi === "busy" || entries.every((e) => e.item.private !== false)}
              onClick={() => void introDraft()}
            >
              {introAi === "busy" ? MEET.profile.introBusy : MEET.profile.introDraft}
            </button>
          )}
          {introAi === "failed" && (
            <p className="m-note" aria-live="polite" style={{ color: "var(--shu-deep)" }}>
              {MEET.profile.introFailed}
            </p>
          )}
        </div>
      </section>

      <section className="m-section m-mem-memory">
        <h2 className="m-h2">{MEET.memory.title}</h2>
        <p className="m-note" style={{ margin: "0 0 0.75rem" }}>
          {MEET.memory.boundary}
        </p>
        {pendingCount > 0 && pubState !== "busy" && (
          <div className="m-pending">
            <span>{MEET.publish.pending(pendingCount)}</span>
            {displayName.trim() !== "" && (
              <button type="button" className="m-btn m-btn-quiet" onClick={() => void publish()}>
                {MEET.publish.update}
              </button>
            )}
          </div>
        )}
        {entries.length === 0 && editing !== "new" && (
          <div className="m-empty">{MEET.memory.empty}</div>
        )}
        <ul className="m-itemlist m-grid2">
          {entries.map((e) => (
            <li key={e.entryId} className="m-item">
              {editing === e.entryId ? (
                <ItemForm
                  initial={e.item}
                  maskWords={maskWords}
                  onUpdateMaskWords={updateMaskWords}
                  onSave={(item) => void saveItem(e.entryId, item)}
                  onCancel={() => setEditing(null)}
                />
              ) : (
                <>
                  <div className="m-item-head">
                    <span className="m-chip">{MEET.kinds[e.item.kind]}</span>
                    <button
                      type="button"
                      className={`m-toggle ${e.item.private ? "" : "m-toggle-on"}`}
                      onClick={() => void togglePublic(e)}
                      aria-pressed={!e.item.private}
                    >
                      {e.item.private ? MEET.intake.privateLabel : MEET.intake.publicLabel}
                    </button>
                  </div>
                  {e.item.title && <p className="m-item-title">{e.item.title}</p>}
                  <p className="m-item-text">{e.item.text}</p>
                  {e.item.tags.length > 0 && (
                    <p className="m-item-tags">{e.item.tags.join(" / ")}</p>
                  )}
                  {!e.item.private && hasPublicVariant(e.item) && (
                    <p className="m-note">
                      {MEET.publicWriting.activeBadge}：{publicFace(e.item)}
                    </p>
                  )}
                  {/* 第6便: one action line — the leak chip appears ONLY on
                      detection (no always-on hint), beside 直す / 消す. */}
                  <div className="m-item-actions">
                    {!e.item.private &&
                      (() => {
                        const view = toPublicView(e.item);
                        const leaks = findMaskLeaks(maskWords, view.title, view.text);
                        return leaks.length > 0 ? (
                          <button
                            type="button"
                            className="m-link"
                            style={{ color: "var(--shu-deep)" }}
                            onClick={() => setEditing(e.entryId)}
                          >
                            {MEET.maskWords.leakChip}
                          </button>
                        ) : null;
                      })()}
                    <button type="button" className="m-link" onClick={() => setEditing(e.entryId)}>
                      {MEET.memory.edit}
                    </button>
                    <button type="button" className="m-link" onClick={() => void removeItem(e.entryId)}>
                      {MEET.memory.remove}
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
          {editing === "new" && (
            <li className="m-item">
              <ItemForm
                initial={BLANK}
                maskWords={maskWords}
                onUpdateMaskWords={updateMaskWords}
                onSave={(item) => void saveItem("new", item)}
                onCancel={() => setEditing(null)}
              />
            </li>
          )}
        </ul>
        {editing !== "new" && (
          <button
            type="button"
            className="m-btn m-btn-quiet m-btn-wide"
            style={{ marginTop: "0.75rem" }}
            onClick={() => setEditing("new")}
          >
            {MEET.memory.addItem}
          </button>
        )}
      </section>

      <section className="m-section m-mem-publish">
        <h2 className="m-h2">{MEET.publish.heading}</h2>
        <div className="m-card">
          {displayName.trim() === "" ? (
            <p className="m-note" style={{ margin: 0 }}>
              {MEET.publish.needName}
            </p>
          ) : publicCount === 0 ? (
            <p className="m-note" style={{ margin: 0 }}>
              {MEET.publish.none}
            </p>
          ) : (
            <>
              <p style={{ margin: "0 0 0.75rem", color: "var(--text)", fontSize: "0.92rem" }}>
                {MEET.publish.body(publicCount)}
              </p>
              <button
                type="button"
                className="m-btn m-btn-primary m-btn-wide"
                onClick={() => void publish()}
                disabled={pubState === "busy"}
              >
                {pubState === "done" ? MEET.publish.update : MEET.publish.action}
              </button>
              {pubState === "done" && (
                <p className="m-note" aria-live="polite">
                  {MEET.publish.done(pubCount)}
                </p>
              )}
              {pubState === "failed" && (
                <p className="m-note" aria-live="polite">
                  {MEET.publish.failed}
                </p>
              )}
              <p className="m-note">{MEET.publish.unpublishNote}</p>
            </>
          )}
        </div>
      </section>

      <section className="m-section m-mem-backup">
        {/* 第6便: the destructive/housekeeping pile rests behind a quiet fold */}
        <details className="m-promise">
          <summary>{MEET.memory.housekeeping}</summary>
          <div className="m-backup" style={{ marginTop: "0.75rem" }}>
            <button type="button" className="m-btn m-btn-quiet" onClick={() => void exportBackup()}>
              {MEET.memory.exportLabel}
            </button>
            <label className="m-btn m-btn-quiet" style={{ cursor: "pointer" }}>
              {MEET.memory.importLabel}
              <input
                type="file"
                accept="application/json,.json"
                style={{ display: "none" }}
                onChange={(e) => void importBackup(e.target.files?.[0])}
              />
            </label>
            <button type="button" className="m-btn m-btn-quiet m-btn-danger" onClick={() => void clearAll()}>
              {MEET.memory.clearAll}
            </button>
          </div>
          {report && <p className="m-note">{report}</p>}
          <p className="m-note">{MEET.memory.durability}</p>
        </details>
      </section>

      <div className="m-mem-foot">
        <BoundaryNote lines={[MEET.boundary.memory, MEET.boundary.ai, MEET.boundary.disclosure]} />
      </div>
      </div>
    </>
  );
}
