"use client";

// R1.5 あなたの記憶 — owner-local manager (Stage B MemoryManager lineage).
// Read / edit / export / import / delete all run on this device; the boundary
// block at the bottom states only what is true in code.

import { useCallback, useEffect, useMemo, useState } from "react";
import { MEET } from "@/lib/meet/copy.ts";
import {
  openMeetMemory,
  toPublicView,
  hasPublicVariant,
  type MeetMemoryEntryV1,
  type MeetRigItemV1,
} from "@/lib/meet-memory";
import {
  getModel,
  getKey,
  getEndpoint,
  isConnected,
  generateProposals,
  buildMaskPrompt,
  parseMaskReply,
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

function ItemForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: MeetRigItemV1;
  onSave: (item: MeetRigItemV1) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<MeetRigItemV1>(initial);
  const [tagsText, setTagsText] = useState(initial.tags.join("、"));
  const [connected] = useState(() => isConnected());
  const [aiState, setAiState] = useState<"idle" | "busy" | "failed">("idle");

  // 伏せ版の下書き — the owner's OWN AI rewrites with proper nouns masked
  // (browser-direct, same lane as proposals); the owner edits, then 保存.
  const aiDraft = async () => {
    setAiState("busy");
    const model = getModel();
    const r = await generateProposals({
      model,
      apiKey: model.provider === "ollama" ? "" : getKey(model.provider),
      endpoint: getEndpoint(),
      prompt: buildMaskPrompt(draft.title, draft.text),
    });
    const masked = r.ok ? parseMaskReply(r.text) : null;
    if (masked === null) {
      setAiState("failed");
      return;
    }
    setDraft((d) => ({
      ...d,
      publicTitle: masked.title !== "" ? masked.title : d.publicTitle,
      publicText: masked.text !== "" ? masked.text : d.publicText,
    }));
    setAiState("idle");
  };

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
      <details style={{ marginTop: "0.6rem" }} open={hasPublicVariant(draft)}>
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
        {connected && (
          <button
            type="button"
            className="m-btn m-btn-quiet"
            style={{ marginTop: "0.4rem" }}
            disabled={aiState === "busy" || draft.text.trim() === ""}
            onClick={() => void aiDraft()}
          >
            {aiState === "busy" ? MEET.publicWriting.aiBusy : MEET.publicWriting.aiDraft}
          </button>
        )}
        {aiState === "failed" && (
          <p className="m-note" aria-live="polite" style={{ color: "var(--shu-deep)" }}>
            {MEET.publicWriting.aiFailed}
          </p>
        )}
      </details>
      <div className="m-item-head" style={{ marginTop: "0.5rem" }}>
        <button
          type="button"
          className={`m-toggle ${draft.private ? "" : "m-toggle-on"}`}
          onClick={() => setDraft((d) => ({ ...d, private: !d.private }))}
          aria-pressed={!draft.private}
        >
          {draft.private ? MEET.intake.privateLabel : MEET.intake.publicLabel}
        </button>
      </div>
      {!draft.private && draft.text.trim() !== "" && (
        // 顔 preview — which words would actually go out, said plainly.
        <p className="m-note" style={{ marginTop: "0.4rem" }}>
          {MEET.publicWriting.preview}
          {publicFace(draft)}
        </p>
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
  const [savedName, setSavedName] = useState(false);
  const [editing, setEditing] = useState<string | null>(null); // entryId | "new"
  const [report, setReport] = useState("");

  const reload = useCallback(async () => {
    setEntries(toRigEntries(await store.list()));
    const profile = await store.getProfile();
    if (profile) setDisplayName(profile.displayName);
  }, [store]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const saveName = async () => {
    await store.setProfile({ displayName: displayName.trim() });
    setSavedName(true);
    setTimeout(() => setSavedName(false), 2000);
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
      <section className="m-section">
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
        </div>
      </section>

      <section className="m-section">
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
        <ul className="m-itemlist">
          {entries.map((e) => (
            <li key={e.entryId} className="m-item">
              {editing === e.entryId ? (
                <ItemForm
                  initial={e.item}
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
                  <div className="m-item-actions">
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

      <section className="m-section">
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

      <section className="m-section">
        <div className="m-backup">
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
      </section>

      <BoundaryNote lines={[MEET.boundary.memory, MEET.boundary.ai, MEET.boundary.disclosure]} />
    </>
  );
}
