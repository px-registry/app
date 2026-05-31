"use client";

// Board Templates v1 + UI Wiring v0 — the owner-local "stand a board" surface
// (/board/stand), now WIRED to the server publish lane.
//
// Drafts still live on the owner's device (IndexedDB); PX holds no draft. What
// changes here: the publish / unpublish buttons now call the hardened owner-write
// endpoints (POST /api/owner/board/{publish,unpublish}) with same-origin
// credentials, and the UI shows each row's SERVER-CONFIRMED state. The reconciliation
// rule is "server-confirmed only": a row is shown public ONLY after the server
// confirms it; a local edit never silently updates the server; an ambiguous publish
// result is `unknown`, never public (the owner is told it may have duplicated). PX
// still judges no content and ranks no board — publishing is a structural gate.

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DraftBoardStore,
  BOARD_TEMPLATES,
  findTemplate,
  templateToNewDraft,
  placeholdersFor,
  evaluatePublicCriteria,
  meetsPublicCriteria,
  rowServerStateKind,
  publishedRecordIdOf,
  TEMPLATE_COPY,
  WIRING_COPY,
  ROW_STATE_LABELS,
  CRITERION_COPY,
  CONTACT_READINESS_LABELS,
  CONTACT_READINESS_KINDS,
  TEMPLATE_BOUNDARY,
  type DraftBoardV1,
  type ContactReadinessKind,
  type PublicContactReadinessV1,
} from "@/lib/board-template/index.ts";
import { IndexedDbDraftBackend } from "@/lib/board-template/indexeddb.ts";
import { fetchMe } from "@/lib/auth-client.ts";
import { SURFACE_SHAPES, INTENTS, surfaceShapeLabel, intentLabel } from "@/lib/board/index.ts";

const C = TEMPLATE_COPY;
const W = WIRING_COPY;

/** How many of a draft's rows are LIVE on the server (public or edited-from-public). */
function liveCount(draft: DraftBoardV1): number {
  return draft.rows.filter((r) => publishedRecordIdOf(r) !== undefined).length;
}

export function BoardStand() {
  const store = useMemo(() => new DraftBoardStore(new IndexedDbDraftBackend()), []);
  const [drafts, setDrafts] = useState<DraftBoardV1[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // null = still checking; the publish path is gated on a real session.
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  const refresh = useCallback(async () => {
    const all = await store.list();
    setDrafts(all);
    return all;
  }, [store]);

  useEffect(() => {
    void refresh();
    void fetchMe().then((m) => setSignedIn(m.signed_in));
  }, [refresh]);

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

  // ── editor actions (owner-local store mutations) ──────────────────────────────
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
            {drafts.map((d) => {
              const live = liveCount(d);
              return (
                <li key={d.draftId}>
                  <button
                    type="button"
                    className={`stand-draft-row${d.draftId === selectedId ? " is-open" : ""}`}
                    onClick={() => setSelectedId(d.draftId === selectedId ? null : d.draftId)}
                  >
                    <span className="listing-title">{d.boardTitle || "(untitled board)"}</span>
                    <span className={`stand-state stand-state-${live > 0 ? "public" : "draft"}`}>
                      {live > 0 ? `${live} ${ROW_STATE_LABELS.public.en}` : C.draftBadge.en}
                    </span>
                  </button>
                  {d.draftId === selectedId && (
                    <DraftEditor
                      store={store}
                      draft={d}
                      act={act}
                      signedIn={signedIn}
                      onRemoved={() => {
                        setSelectedId(null);
                        void refresh();
                      }}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <details className="mem-boundary">
        <summary>What PX does (and does not) do here</summary>
        <ul>
          <li>Your draft boards live on this device. PX holds no draft and no board state.</li>
          <li>A template is a starting point — PX ranks no board and judges no content.</li>
          <li>Publishing needs a title, at least one row, and a way to be contacted — a structural check, not a verdict.</li>
          <li>A row is shown “{ROW_STATE_LABELS.public.en}” only after the server confirms it. Unpublishing takes it down.</li>
        </ul>
        <pre className="mem-boundary-json">{JSON.stringify(TEMPLATE_BOUNDARY, null, 2)}</pre>
      </details>
    </>
  );
}

type Notice = { tone: "error" | "warn" | "ok"; text: string };

function DraftEditor({
  store,
  draft,
  act,
  signedIn,
  onRemoved,
}: {
  store: DraftBoardStore;
  draft: DraftBoardV1;
  act: (fn: () => Promise<unknown>) => Promise<void>;
  signedIn: boolean | null;
  onRemoved: () => void;
}) {
  const template = draft.templateId ? findTemplate(draft.templateId) : undefined;
  const placeholders = template ? placeholdersFor(template) : [];
  const criteria = evaluatePublicCriteria(draft);
  const canPublish = meetsPublicCriteria(draft);
  const live = liveCount(draft);

  // A single in-flight guard for every server call (MF2: no double-submit).
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  const contactKind: ContactReadinessKind | "" = draft.contact?.kind ?? "";
  const contactUrl =
    draft.contact && draft.contact.kind !== "manual_copy" ? draft.contact.externalActionUrl : "";

  const setContact = (kind: ContactReadinessKind | "", url: string) => {
    if (kind === "") return act(() => store.setContact(draft.draftId, undefined));
    const next: PublicContactReadinessV1 =
      kind === "manual_copy" ? { kind } : { kind, externalActionUrl: url };
    return act(() => store.setContact(draft.draftId, next));
  };

  // ── server publish (server-confirmed only, fail-closed) ───────────────────────
  const publishToBoard = async () => {
    if (busy || !canPublish) return;
    if (signedIn === false) {
      setNotice({ tone: "error", text: W.signInToPublish.en });
      return;
    }
    setBusy(true);
    setNotice(null);
    const attempted = draft.rows.map((r) => r.rowId);
    const payload = {
      boardTitle: draft.boardTitle,
      ...(draft.contact ? { contact: draft.contact } : {}),
      rows: draft.rows.map((r) => ({
        surfaceShape: r.surfaceShape,
        intent: r.intent,
        title: r.title,
        ...(r.summary != null ? { summary: r.summary } : {}),
        localRowId: r.rowId, // reconciliation key — echoed back, never stored server-side
      })),
    };
    let res: Response;
    try {
      res = await fetch("/api/owner/board/publish", {
        method: "POST",
        credentials: "include", // session cookie; the Origin guard verifies same-origin
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch {
      // Network/timeout — result UNKNOWN (MF2). Do NOT treat as public.
      await act(() => store.markRowsUnknown(draft.draftId, attempted));
      setNotice({ tone: "warn", text: W.unknownResult.en });
      setBusy(false);
      return;
    }
    if (res.status === 401) {
      setNotice({ tone: "error", text: W.signInToPublish.en }); // session gone — never auto-signin
      setBusy(false);
      return;
    }
    if (!res.ok) {
      // 400 (cap/canonical) / 403 / 500 — fail-closed: nothing becomes public.
      setNotice({ tone: "error", text: W.publishFailed.en });
      setBusy(false);
      return;
    }
    let out: { published?: Array<{ localRowId?: unknown; recordId?: unknown }> };
    try {
      out = await res.json();
    } catch {
      await act(() => store.markRowsUnknown(draft.draftId, attempted)); // 2xx but unreadable → unknown
      setNotice({ tone: "warn", text: W.unknownResult.en });
      setBusy(false);
      return;
    }
    const confirmed = (out.published ?? []).filter(
      (p): p is { localRowId: string; recordId: string } =>
        typeof p?.localRowId === "string" && typeof p?.recordId === "string",
    );
    await act(() => store.applyPublishResult(draft.draftId, confirmed));
    const confirmedIds = new Set(confirmed.map((c) => c.localRowId));
    const missing = attempted.filter((id) => !confirmedIds.has(id));
    if (missing.length) await act(() => store.markRowsUnknown(draft.draftId, missing));
    setNotice(missing.length ? { tone: "warn", text: W.unknownResult.en } : { tone: "ok", text: W.publishedOk.en });
    setBusy(false);
  };

  // ── server unpublish (only retire on a confirmed 200) ─────────────────────────
  const unpublishOne = async (recordId: string): Promise<{ ok: boolean; status?: number }> => {
    let res: Response;
    try {
      res = await fetch("/api/owner/board/unpublish", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordId }),
      });
    } catch {
      return { ok: false };
    }
    if (res.ok) {
      await act(() => store.applyUnpublishResult(draft.draftId, recordId));
      return { ok: true };
    }
    return { ok: false, status: res.status }; // 403/404/500 → row stays public (fail-closed)
  };

  const unpublishRow = async (recordId: string) => {
    if (busy) return;
    setBusy(true);
    setNotice(null);
    const r = await unpublishOne(recordId);
    if (!r.ok) setNotice({ tone: "error", text: r.status === 403 ? W.notYourRow.en : W.unpublishFailed.en });
    setBusy(false);
  };

  const unpublishBoard = async () => {
    if (busy) return;
    setBusy(true);
    setNotice(null);
    const recs = draft.rows.map((r) => publishedRecordIdOf(r)).filter((x): x is string => x !== undefined);
    let failed = 0;
    for (const rec of recs) {
      const r = await unpublishOne(rec);
      if (!r.ok) failed += 1;
    }
    if (failed) setNotice({ tone: "error", text: W.unpublishFailed.en });
    setBusy(false);
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
        {draft.rows.map((r, i) => {
          const stateKind = rowServerStateKind(r);
          const liveRecordId = publishedRecordIdOf(r);
          return (
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
                <span className={`stand-rowstate stand-rowstate-${stateKind}`}>{ROW_STATE_LABELS[stateKind].en}</span>
              </div>
              <input
                className="board-search-input"
                defaultValue={r.title}
                placeholder={placeholders[i] ?? C.rowTitlePlaceholder.en}
                onBlur={(e) => act(() => store.updateRow(draft.draftId, r.rowId, { title: e.target.value }))}
              />
              {stateKind === "local-edits-not-published" && (
                <p className="board-action-note stand-needs">{W.editsNotPublishedNote.en}</p>
              )}
              <div className="stand-row-actions">
                {liveRecordId && (
                  <button type="button" className="board-chip" disabled={busy} onClick={() => void unpublishRow(liveRecordId)}>
                    {W.unpublishRow.en}
                  </button>
                )}
                {/* A live row can't be removed (it would orphan a public row) — unpublish first. */}
                <button
                  type="button"
                  className="mem-del"
                  aria-label={C.removeRow.en}
                  disabled={liveRecordId !== undefined}
                  title={liveRecordId ? W.unpublishRow.en : undefined}
                  onClick={() => act(() => store.removeRow(draft.draftId, r.rowId))}
                >
                  ✕
                </button>
              </div>
            </li>
          );
        })}
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

      {/* Empty-board prevention, shown plainly (structural, never a verdict). */}
      {!canPublish && (
        <p className="board-action-note stand-needs">
          {C.needsBeforePublish.en} {criteria.missing.map((k) => CRITERION_COPY[k].en).join(" · ")}
        </p>
      )}

      {/* Server reconciliation notice (error / unknown / ok). */}
      {notice && <p className={`board-action-note stand-notice stand-notice-${notice.tone}`}>{notice.text}</p>}

      {/* Not signed in → guide to the existing passkey sign-in (no auto-signin / account creation). */}
      {signedIn === false && (
        <p className="board-action-note stand-needs">
          {W.signInToPublish.en}{" "}
          <a href="/signin/?next=/board/stand/">{W.signInLink.en}</a>
        </p>
      )}

      <div className="stand-actions">
        <button
          type="button"
          className="board-chip stand-publish"
          disabled={busy || !canPublish || signedIn === false}
          onClick={() => void publishToBoard()}
        >
          {busy ? W.publishing.en : W.publishToBoard.en}
        </button>
        {live > 0 && (
          <button type="button" className="board-chip" disabled={busy} onClick={() => void unpublishBoard()}>
            {W.unpublishBoard.en}
          </button>
        )}
        <button
          type="button"
          className="mem-del"
          onClick={() => {
            if (liveCount(draft) > 0) {
              window.alert("Take this board down first — it still has rows on the public board.");
              return;
            }
            if (window.confirm("Delete this draft from this device? PX holds no copy.")) {
              void act(() => store.remove(draft.draftId)).then(onRemoved);
            }
          }}
        >
          delete
        </button>
      </div>
    </div>
  );
}
