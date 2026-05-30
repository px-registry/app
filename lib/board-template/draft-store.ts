// Board Templates v1 — owner-local draft store.
//
// The single write path for draft boards. Every create/edit runs through a
// STRUCTURAL validator (rows must carry canonical surface_shape + intent — a row is
// a concrete slot, never a formless blob) and nothing here calls a network: list,
// edit, publish, delete all happen on the owner's device.
//
// ★ Publish is OWNER ACTION, never automatic (C3). `publish()` only flips the state
// after the structural criteria pass; there is NO code path that auto-publishes on
// criteria-pass, and the criteria it checks are structural existence/count, never
// content quality. `unpublish()` is the kill-switch — the owner can always pull a
// board back to draft (§4).

import { isSurfaceShape, isIntent } from "../board/canonical.ts";
import { meetsPublicCriteria } from "./criteria.ts";
import type { DraftBackend } from "./backend.ts";
import type {
  DraftBoardV1,
  DraftBoardRow,
  NewDraftBoard,
  NewDraftBoardRow,
  PublicContactReadinessV1,
} from "./types.ts";

function randId(prefix: string): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return `${prefix}_${btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}`;
}

/** Structural validation of a row: both canonical axes must be valid. CONTENT is
 *  never inspected — title/summary text is the owner's, unjudged. */
function assertRowStructural(r: NewDraftBoardRow): void {
  if (!isSurfaceShape(r.surfaceShape)) throw new Error(`invalid surface_shape: ${String(r.surfaceShape)}`);
  if (!isIntent(r.intent)) throw new Error(`invalid intent: ${String(r.intent)}`);
  if (typeof r.title !== "string") throw new Error("row title must be a string");
}

export class DraftBoardStore {
  private backend: DraftBackend;
  private now: () => string;
  private genId: (prefix: string) => string;

  constructor(backend: DraftBackend, opts?: { now?: () => string; genId?: (prefix: string) => string }) {
    this.backend = backend;
    this.now = opts?.now ?? (() => new Date().toISOString());
    this.genId = opts?.genId ?? randId;
  }

  list(): Promise<DraftBoardV1[]> {
    return this.backend.list();
  }
  listByState(state: DraftBoardV1["publicationState"]): Promise<DraftBoardV1[]> {
    return this.backend.list().then((all) => all.filter((d) => d.publicationState === state));
  }
  get(id: string): Promise<DraftBoardV1 | undefined> {
    return this.backend.get(id);
  }

  /**
   * Create a draft. Rows are structurally validated; a new draft always starts in
   * `draft` state (never `public` — publishing is a later, explicit owner action).
   * A draft with no rows / no title is allowed at creation — it simply cannot be
   * published until the structural criteria are met.
   */
  async create(input: NewDraftBoard): Promise<DraftBoardV1> {
    for (const r of input.rows) assertRowStructural(r);
    const at = this.now();
    const draft: DraftBoardV1 = {
      draftId: this.genId("draft"),
      boardTitle: input.boardTitle,
      rows: input.rows.map((r) => this.toRow(r)),
      ...(input.contact ? { contact: input.contact } : {}),
      ...(input.templateId ? { templateId: input.templateId } : {}),
      publicationState: "draft",
      createdAt: at,
      updatedAt: at,
    };
    await this.backend.put(draft);
    return draft;
  }

  private toRow(r: NewDraftBoardRow): DraftBoardRow {
    return {
      rowId: this.genId("row"),
      surfaceShape: r.surfaceShape,
      intent: r.intent,
      title: r.title,
      ...(r.summary != null ? { summary: r.summary } : {}),
    };
  }

  /** Rename the board. */
  async rename(id: string, boardTitle: string): Promise<DraftBoardV1> {
    return this.mutate(id, (d) => ({ ...d, boardTitle }));
  }

  /** Set / change the contact readiness (or clear it with `undefined`). */
  async setContact(id: string, contact: PublicContactReadinessV1 | undefined): Promise<DraftBoardV1> {
    return this.mutate(id, (d) => {
      const next = { ...d };
      if (contact) next.contact = contact;
      else delete next.contact;
      return next;
    });
  }

  /** Append an owner-authored row (structurally validated). */
  async addRow(id: string, row: NewDraftBoardRow): Promise<DraftBoardV1> {
    assertRowStructural(row);
    return this.mutate(id, (d) => ({ ...d, rows: [...d.rows, this.toRow(row)] }));
  }

  /** Edit a row's owner-authored fields (canonical axes re-validated). */
  async updateRow(id: string, rowId: string, patch: Partial<NewDraftBoardRow>): Promise<DraftBoardV1> {
    return this.mutate(id, (d) => {
      const rows = d.rows.map((r) => {
        if (r.rowId !== rowId) return r;
        const merged = { ...r, ...patch };
        assertRowStructural(merged);
        const next: DraftBoardRow = {
          rowId: r.rowId,
          surfaceShape: merged.surfaceShape,
          intent: merged.intent,
          title: merged.title,
          ...(merged.summary != null ? { summary: merged.summary } : {}),
        };
        return next;
      });
      return { ...d, rows };
    });
  }

  /** Remove a row. */
  async removeRow(id: string, rowId: string): Promise<DraftBoardV1> {
    return this.mutate(id, (d) => ({ ...d, rows: d.rows.filter((r) => r.rowId !== rowId) }));
  }

  /**
   * Publish — OWNER ACTION. Only succeeds when the STRUCTURAL criteria pass; throws
   * otherwise (empty-board prevention). Never called automatically anywhere.
   */
  async publish(id: string): Promise<DraftBoardV1> {
    const draft = await this.backend.get(id);
    if (!draft) throw new Error("draft not found");
    if (!meetsPublicCriteria(draft)) {
      throw new Error("cannot publish: the minimum public criteria are not met");
    }
    return this.mutate(id, (d) => ({ ...d, publicationState: "public" }));
  }

  /** Unpublish — the owner pulls a board back to draft (kill-switch, §4). */
  async unpublish(id: string): Promise<DraftBoardV1> {
    return this.mutate(id, (d) => ({ ...d, publicationState: "draft" }));
  }

  remove(id: string): Promise<void> {
    return this.backend.remove(id);
  }
  clear(): Promise<void> {
    return this.backend.clear();
  }

  private async mutate(id: string, fn: (d: DraftBoardV1) => DraftBoardV1): Promise<DraftBoardV1> {
    const existing = await this.backend.get(id);
    if (!existing) throw new Error("draft not found");
    const updated = { ...fn(existing), updatedAt: this.now() };
    await this.backend.put(updated);
    return updated;
  }
}
