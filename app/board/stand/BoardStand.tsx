"use client";

// Board Templates v1 — the owner-local "stand a board" surface (/board/stand).
//
// Everything here happens on the owner's own device. Drafts live in IndexedDB; PX
// holds no draft and no board/draft state. A template is a SCAFFOLD — a starting
// point the owner edits, ignores, or skips (start blank). The structural gate (a
// title + at least one row + a way to be contacted) is the ONLY thing standing
// between a draft and publish; PX judges no content and ranks no board. The firmness
// is in the gate; the surface stays light — stand a board easily, you decide what to
// collect.

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DraftBoardStore,
  BOARD_TEMPLATES,
  findTemplate,
  templateToNewDraft,
  placeholdersFor,
  evaluatePublicCriteria,
  meetsPublicCriteria,
  TEMPLATE_COPY,
  CRITERION_COPY,
  CONTACT_READINESS_LABELS,
  CONTACT_READINESS_KINDS,
  TEMPLATE_BOUNDARY,
  type DraftBoardV1,
  type ContactReadinessKind,
  type PublicContactReadinessV1,
} from "@/lib/board-template/index.ts";
import { IndexedDbDraftBackend } from "@/lib/board-template/indexeddb.ts";
import { SURFACE_SHAPES, INTENTS, surfaceShapeLabel, intentLabel } from "@/lib/board/index.ts";

const C = TEMPLATE_COPY;

export function BoardStand() {
  const store = useMemo(() => new DraftBoardStore(new IndexedDbDraftBackend()), []);
  const [drafts, setDrafts] = useState<DraftBoardV1[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const all = await store.list();
    setDrafts(all);
    return all;
  }, [store]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const selected = (drafts ?? []).find((d) => d.draftId === selectedId) ?? null;

  const startFromTemplate = useCallback(
    async (templateId: string) => {
      const template = findTemplate(templateId);
      if (!template) return;
      const created = await store.create(templateToNewDraft(template));
      await refresh();
      setSelectedId(created.draftId);
    },
    [store, refresh],
  );

  const startBlank = useCallback(async () => {
    const created = await store.create({ boardTitle: "", rows: [] });
    await refresh();
    setSelectedId(created.draftId);
  }, [store, refresh]);

  // ── editor actions (all owner-local) ──────────────────────────────────────────
  const act = useCallback(
    async (fn: () => Promise<unknown>) => {
      await fn();
      await refresh();
    },
    [refresh],
  );

  return (
    <>
      <p className="board-action-note">{C.sub.en}</p>

      {/* Starting points — fixed neutral order, never a ranking. */}
      <section className="stand-templates">
        <h2 className="stand-h2">{C.templatesHeading.en}</h2>
        <p className="board-action-note">{C.templatesNote.en}</p>
        <ul className="stand-template-list">
          {BOARD_TEMPLATES.map((t) => (
            <li key={t.templateId} className="stand-template">
              <span className="stand-template-label">{t.useCaseLabel}</span>
              <button type="button" className="board-chip" onClick={() => void startFromTemplate(t.templateId)}>
                {C.startFrom.en}
              </button>
            </li>
          ))}
          <li className="stand-template">
            <span className="stand-template-label">{C.startBlank.en}</span>
            <button type="button" className="board-chip" onClick={() => void startBlank()}>
              {C.startBlank.en}
            </button>
          </li>
        </ul>
      </section>

      {/* The owner's drafts on this device. */}
      <section className="stand-drafts">
        {drafts === null ? (
          <p className="entries">Loading…</p>
        ) : drafts.length === 0 ? (
          <p className="board-action-note">Nothing yet — start from an example or a blank board above.</p>
        ) : (
          <ul className="listings stand-draft-list">
            {drafts.map((d) => (
              <li key={d.draftId}>
                <button
                  type="button"
                  className={`stand-draft-row${d.draftId === selectedId ? " is-open" : ""}`}
                  onClick={() => setSelectedId(d.draftId === selectedId ? null : d.draftId)}
                >
                  <span className="listing-title">{d.boardTitle || "(untitled board)"}</span>
                  <span className={`stand-state stand-state-${d.publicationState}`}>
                    {d.publicationState === "public" ? C.publicBadge.en : C.draftBadge.en}
                  </span>
                </button>
                {d.draftId === selectedId && <DraftEditor store={store} draft={d} act={act} onRemoved={() => { setSelectedId(null); void refresh(); }} />}
              </li>
            ))}
          </ul>
        )}
      </section>

      <details className="mem-boundary">
        <summary>What PX does (and does not) do here</summary>
        <ul>
          <li>Your draft boards live on this device. PX holds no draft and no board state.</li>
          <li>A template is a starting point — PX ranks no board and judges no content.</li>
          <li>Becoming publish-ready needs a title, at least one row, and a way to be contacted — a structural check, not a verdict.</li>
          <li>Publish-ready is on this device only; appearing on the public board is a later server step, not yet wired.</li>
        </ul>
        <pre className="mem-boundary-json">{JSON.stringify(TEMPLATE_BOUNDARY, null, 2)}</pre>
      </details>
    </>
  );
}

function DraftEditor({
  store,
  draft,
  act,
  onRemoved,
}: {
  store: DraftBoardStore;
  draft: DraftBoardV1;
  act: (fn: () => Promise<unknown>) => Promise<void>;
  onRemoved: () => void;
}) {
  const template = draft.templateId ? findTemplate(draft.templateId) : undefined;
  const placeholders = template ? placeholdersFor(template) : [];
  const criteria = evaluatePublicCriteria(draft);
  const canPublish = meetsPublicCriteria(draft);

  const contactKind: ContactReadinessKind | "" = draft.contact?.kind ?? "";
  const contactUrl =
    draft.contact && draft.contact.kind !== "manual_copy" ? draft.contact.externalActionUrl : "";

  const setContact = (kind: ContactReadinessKind | "", url: string) => {
    if (kind === "") return act(() => store.setContact(draft.draftId, undefined));
    const next: PublicContactReadinessV1 =
      kind === "manual_copy" ? { kind } : { kind, externalActionUrl: url };
    return act(() => store.setContact(draft.draftId, next));
  };

  return (
    <div className="stand-editor">
      <label className="stand-field">
        <span className="stand-label">{C.boardTitleLabel.en}</span>
        <input
          className="board-search-input"
          defaultValue={draft.boardTitle}
          placeholder={C.boardTitlePlaceholder.en}
          onBlur={(e) => act(() => store.rename(draft.draftId, e.target.value))}
        />
      </label>

      <h3 className="stand-h3">{C.rowsHeading.en}</h3>
      <ul className="stand-rows">
        {draft.rows.map((r, i) => (
          <li key={r.rowId} className="stand-row">
            <div className="stand-row-axes">
              <select
                className="stand-select"
                defaultValue={r.surfaceShape}
                aria-label="surface shape"
                onChange={(e) => act(() => store.updateRow(draft.draftId, r.rowId, { surfaceShape: e.target.value as DraftBoardV1["rows"][number]["surfaceShape"] }))}
              >
                {SURFACE_SHAPES.map((s) => (
                  <option key={s} value={s}>{surfaceShapeLabel(s).en}</option>
                ))}
              </select>
              <select
                className="stand-select"
                defaultValue={r.intent}
                aria-label="intent"
                onChange={(e) => act(() => store.updateRow(draft.draftId, r.rowId, { intent: e.target.value as DraftBoardV1["rows"][number]["intent"] }))}
              >
                {INTENTS.map((it) => (
                  <option key={it} value={it}>{intentLabel(it).en}</option>
                ))}
              </select>
            </div>
            <input
              className="board-search-input"
              defaultValue={r.title}
              placeholder={placeholders[i] ?? C.rowTitlePlaceholder.en}
              onBlur={(e) => act(() => store.updateRow(draft.draftId, r.rowId, { title: e.target.value }))}
            />
            <button type="button" className="mem-del" aria-label={C.removeRow.en} onClick={() => act(() => store.removeRow(draft.draftId, r.rowId))}>
              ✕
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="board-chip"
        onClick={() => act(() => store.addRow(draft.draftId, { surfaceShape: "stand", intent: "wanted", title: "" }))}
      >
        {C.addRow.en}
      </button>

      <h3 className="stand-h3">{C.contactHeading.en}</h3>
      <p className="board-action-note">{C.contactNote.en}</p>
      <div className="stand-contact">
        <select
          className="stand-select"
          value={contactKind}
          aria-label={C.contactHeading.en}
          onChange={(e) => setContact(e.target.value as ContactReadinessKind | "", contactUrl)}
        >
          <option value="">—</option>
          {CONTACT_READINESS_KINDS.map((k) => (
            <option key={k} value={k}>{CONTACT_READINESS_LABELS[k].en}</option>
          ))}
        </select>
        {contactKind !== "" && contactKind !== "manual_copy" && (
          <input
            className="board-search-input"
            defaultValue={contactUrl}
            placeholder="https://…"
            aria-label="external link"
            onBlur={(e) => setContact(contactKind, e.target.value)}
          />
        )}
      </div>

      {/* Empty-board prevention, shown plainly. */}
      {!canPublish && (
        <p className="board-action-note stand-needs">
          {C.needsBeforePublish.en} {criteria.missing.map((k) => CRITERION_COPY[k].en).join(" · ")}
        </p>
      )}

      {/* S3: publish-ready ≠ live on the public board. */}
      <p className="board-action-note stand-needs">{C.publishReadyNote.en}</p>

      <div className="stand-actions">
        {draft.publicationState === "draft" ? (
          <button type="button" className="board-chip stand-publish" disabled={!canPublish} onClick={() => act(() => store.publish(draft.draftId))}>
            {C.publish.en}
          </button>
        ) : (
          <button type="button" className="board-chip" onClick={() => act(() => store.unpublish(draft.draftId))}>
            {C.unpublish.en}
          </button>
        )}
        <button
          type="button"
          className="mem-del"
          onClick={() => {
            if (window.confirm("Delete this draft from this device? PX holds no copy.")) void act(() => store.remove(draft.draftId)).then(onRemoved);
          }}
        >
          delete
        </button>
      </div>
    </div>
  );
}
